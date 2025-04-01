import { promises as fs } from 'fs';
import * as cheerio from 'cheerio';
import ical from 'ical-generator';
import { DateTime } from 'luxon';

const SCHEDULE_URL = 'https://vgmcon.org/schedule/';
const START_DATE = '2025-04-10';
const OUTPUT_FILE_NAME = 'vgmcon2025.ics';

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
            const title = header.replace(/^\[.+\]\s*/, '');
            const timeframe = $event.find('.data .session').text();
            const [start, end] = timeframe.replace(/^\D+/, '').split(/\s*-\s*/);
            const location = $event.find('.quick_info .presenter').text();
            const presenter = $event.find('.quick_info .location').text();
            const description = $event.find('.details .description').text();
            const type = $event.find('.data .theme').text();
            // Friday 19 Apr 2024
            const calEv = {
                start: DateTime.fromFormat(
                    `${dayStr} ${start}`,
                    'EEEE dd LLL yyyy h:mm a',
                    { zone: 'America/Chicago' }
                ),
                end: DateTime.fromFormat(
                    `${dayStr} ${end}`,
                    'EEEE dd LLL yyyy h:mm a',
                    { zone: 'America/Chicago' }
                ),
                title,
                presenter,
                location,
                description,
                type,
            };

            // console.log(JSON.stringify(calEv));
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
    await fs.writeFile(OUTPUT_FILE_NAME, cal.toString(), 'utf-8');
}

main().catch((err) => {
    console.log(err);
    process.exitCode = 1;
});
