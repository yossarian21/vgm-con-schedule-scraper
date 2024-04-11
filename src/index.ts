import { promises as fs } from 'fs';
import * as cheerio from 'cheerio';
import ical from 'ical-generator';
import { DateTime } from 'luxon';

const SCHEDULE_URL = 'https://vgmcon.org/2024-schedule/';
const START_DATE = '2024-04-19';

async function loadHtml() {
    try {
        await fs.stat('schedule.html');
        return await fs.readFile('schedule.html', 'utf8');
    } catch (err) {
        const res = await fetch(SCHEDULE_URL);
        if (!res.ok) {
            throw new Error(await res.text());
        }

        const body = await res.text();

        await fs.writeFile('schedule.html', body, 'utf-8');
        return body;
    }
}

async function main() {
    const body = await loadHtml();
    const $ = cheerio.load(body);

    const days = $('.conference_day');

    const calEvents: any[] = [];

    for (const day of days) {
        const $day = $(day);
        const dayStr = $day.find('> h3').text();
        const events = $day.find('.conf_block');
        for (const event of events) {
            const $event = $(event);
            const header = $event.children('.title').text();
            let [range, title] = header.split(/\]\s*/);
            const [start, end] = range.replace('[', '').split(/\s*-\s*/);
            const location = $event.find('.quick_info .presenter').text();
            const presenter = $event.find('.quick_info .location').text();
            const description = $event.find('.details .description').text();
            const type = $event.find('.data .theme').text();
            // Friday 19 Apr 2024
            const calEv = {
                start: DateTime.fromFormat(
                    `${dayStr} ${start}m`,
                    'EEEE dd LLL yyyy h:mma',
                    { zone: 'America/Chicago' }
                ),
                end: DateTime.fromFormat(
                    `${dayStr} ${end}m`,
                    'EEEE dd LLL yyyy h:mma',
                    { zone: 'America/Chicago' }
                ),
                title,
                presenter,
                location,
                description,
                type,
            };
            if (start.endsWith('p') && end.endsWith('a')) {
                calEv.end = calEv.end.plus({ day: 1 });
            }
            if (calEv.start.isValid && calEv.end.isValid) {
                calEvents.push(calEv);
            }
        }
    }

    const cal = ical({
        events: calEvents.map((e) => ({
            summary: `${e.type}: ${e.title} (${e.presenter})`,
            description: e.description,
            start: e.start,
            end: e.end,
            location: e.location,
            categories: e.type ? [{ name: e.type }] : [],
        })),
    });
    await fs.writeFile('vgmcon2024.ics', cal.toString(), 'utf-8');
}

main().catch((err) => {
    console.log(err);
    process.exitCode = 1;
});
