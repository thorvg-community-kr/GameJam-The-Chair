import { FIXED_STEP } from './game/level';
import {
    clipReplay,
    normalizeReplayEdit,
    normalizeReplaySettings,
    readReplayEdit,
    readReplaySources,
    REPLAY_DEFAULTS,
    REPLAY_EDIT_LIMITS,
    replayEditKey,
} from './game/replay';
import { CONFIG_VERSION } from './game/stages/index';
import { browserLocale, isMessage, keepLangOnLinks, translate } from './i18n';
import { createRenderer } from './render/renderer';
import { createReplayPlayer } from './ui/replay-player';
import {
    copyText,
    downloadJson,
    loadBrowserData,
    loadReplayEdit,
    saveReplayEdit,
    stamp,
} from './ui/replay-store';

import type {
    ReplayEdit,
    ReplaySettings,
    ReplaySource,
    Timeline,
} from './game/replay';
import type { Locale, Message } from './i18n';
import './style.css';
import './preview.css';
import './replay-tool.css';

const $ = <T extends HTMLElement>(selector: string) =>
    document.querySelector<T>(selector)!;
const locale: Locale = browserLocale();
keepLangOnLinks();
const t = (message: Message) => translate(message, locale);
document.documentElement.lang = locale;
for (const element of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = element.dataset.i18n!;
    if (isMessage(key)) {
        element.textContent = t(key);
    }
}
for (const element of document.querySelectorAll<HTMLElement>(
    '[data-i18n-aria]',
)) {
    const key = element.dataset.i18nAria!;
    if (isMessage(key)) {
        element.setAttribute('aria-label', t(key));
    }
}

const compactEditBar = window.matchMedia('(max-width: 1200px)');
const editMore = $<HTMLDetailsElement>('.tool-edit-more');
const syncEditMenu = () => {
    editMore.open = !compactEditBar.matches;
};
compactEditBar.addEventListener('change', syncEditMenu);
syncEditMenu();

const root = $('#chair-office-one');
const status = $('#status');
const sourcesSelect = $<HTMLSelectElement>('#sources');
let settings: ReplaySettings = { ...REPLAY_DEFAULTS };
let sources: ReplaySource[] = [];
let selected: ReplaySource | null = null;
let edit: ReplayEdit = { markers: [], range: null };
let editKey = '';

const renderer = (() => {
    try {
        return createRenderer(root, () => locale);
    } catch (error) {
        console.error(error);
        return null;
    }
})();
const player = createReplayPlayer(
    root,
    () => locale,
    () => settings,
    () => {},
    { closable: false },
);

const viewerInputs = {
    keyframeInterval: $<HTMLInputElement>('#keyframe'),
    warmupSeconds: $<HTMLInputElement>('#warmup'),
    playbackSpeed: $<HTMLInputElement>('#speed'),
};
for (const [key, input] of Object.entries(viewerInputs)) {
    input.value = String(settings[key as keyof typeof viewerInputs]);
    input.addEventListener('change', () => {
        const before = settings.keyframeInterval;
        settings = normalizeReplaySettings({ ...settings, [key]: input.value });
        for (const [other, field] of Object.entries(viewerInputs)) {
            field.value = String(settings[other as keyof typeof viewerInputs]);
        }
        if (
            key === 'keyframeInterval' &&
            settings.keyframeInterval !== before &&
            selected
        ) {
            const tick = player.tick;
            const loop = player.loop;
            open(selected);
            player.setLoop(loop);
            player.seek(tick);
            player.setPlaying(false);
        }
    });
}

function load(text: string, origin: string) {
    try {
        const result = readReplaySources(text);
        sources = result.sources;
        sourcesSelect.replaceChildren(
            ...sources.map((source, i) => new Option(source.label, String(i))),
        );
        status.textContent = `${t('tool.loaded')}: ${origin} · ${sources.length}`;
        if (sources.length) {
            sourcesSelect.selectedIndex = 0;
            open(sources[0]);
        }
    } catch (error) {
        status.textContent = `${t('replay.badFile')} (${error instanceof Error ? error.message : String(error)})`;
    }
}

function open(source: ReplaySource) {
    $('#edit-status').textContent = '';
    selected = source;
    const timeline = player.open(source.file);
    $('#empty').hidden = true;
    const seconds = (tick: number) =>
        ((tick - timeline.startTick) * FIXED_STEP).toFixed(2) + 's';
    const facts: Array<[string, string]> = [
        [
            'version',
            `${source.file.version || '—'}${timeline.versionMismatch ? ` ≠ ${CONFIG_VERSION}` : ' ✓'}`,
        ],
        ['seed', String(source.file.seed ?? '—')],
        [
            'stage',
            `${source.file.start.stage} · flag ${source.file.start.checkpoint}`,
        ],
        [
            'ticks',
            `${timeline.startTick} → ${timeline.endTick} (${seconds(timeline.endTick)})`,
        ],
        [
            'commands',
            String(source.file.commands.length) +
                (source.file.truncated ? ' (cut)' : ''),
        ],
        [
            'hashes',
            `${source.file.hashes.length} · ${timeline.divergedAt === null ? 'match' : `differ at ${timeline.divergedAt}`}`,
        ],
        ['keyframes', String(timeline.keyframes.length)],
    ];
    fill($('#file-info'), facts);
    const error = timeline.error ?? source.file.error;
    const errorInfo = $('#error-info');
    errorInfo.hidden = !error;
    errorInfo.textContent = error
        ? [
              `${error.at} @ tick ${error.tick}`,
              error.message,
              source.error?.time ?? '',
              error.stack ?? '',
          ]
              .filter(Boolean)
              .join('\n')
        : '';
    $('#markers').replaceChildren(
        ...timeline.markers.map((marker) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `tool-marker tool-marker-${marker.kind}`;
            button.textContent = `${marker.kind} · ${seconds(marker.tick)}`;
            button.addEventListener('click', () => {
                player.seek(marker.tick);
                player.setPlaying(false);
            });
            return button;
        }),
    );
    editKey = replayEditKey(source.file);
    edit = readReplayEdit(loadReplayEdit(editKey), source.file) ??
        source.file.edit ?? { markers: [], range: null };
    applyEdit(timeline, false);
    lastShown = -1;
}

const seconds = (tick: number) =>
    player.timeline
        ? `${((tick - player.timeline.startTick) * FIXED_STEP).toFixed(2)}s`
        : '';

function applyEdit(timeline: Timeline, save = true) {
    edit = normalizeReplayEdit(edit, timeline.startTick, timeline.endTick);
    if (save) {
        saveReplayEdit(editKey, edit);
    }
    player.setUserMarkers(edit.markers);
    player.setRange(edit.range);
    renderUserMarkers();
    const range = edit.range;
    $('#start-time').textContent = seconds(range?.start ?? timeline.startTick);
    $('#end-time').textContent = seconds(range?.end ?? timeline.endTick);
    $('#range-info').textContent = range
        ? `${((range.end - range.start) * FIXED_STEP).toFixed(2)}s`
        : t('tool.rangeNone');
    for (const id of ['#add-marker', '#range-start', '#range-end']) {
        $<HTMLButtonElement>(id).disabled = false;
    }
    for (const id of [
        '#range-clear',
        '#download-clip',
        '#copy-clip',
        '#range-loop',
    ]) {
        $<HTMLButtonElement>(id).disabled = !range;
    }
    syncLoop();
}

function syncLoop() {
    $('#range-loop').setAttribute(
        'aria-pressed',
        String(!!edit.range && player.loop),
    );
}

function editNow(change: (tick: number, timeline: Timeline) => void) {
    const timeline = player.timeline;
    if (timeline) {
        $('#edit-status').textContent = '';
        change(player.tick, timeline);
        applyEdit(timeline);
    }
}

let markerHere = -1;
function renderUserMarkers() {
    markerHere = -1;
    $('#marker-list').hidden = edit.markers.length === 0;
    $('#user-markers').replaceChildren(
        ...edit.markers.map((marker) => {
            const item = document.createElement('li');
            item.dataset.tick = String(marker.tick);
            const jump = document.createElement('button');
            jump.type = 'button';
            jump.className = 'tool-jump';
            jump.textContent = seconds(marker.tick);
            jump.addEventListener('click', () => {
                player.seek(marker.tick);
                player.setPlaying(false);
            });
            const name = document.createElement('input');
            name.value = marker.label;
            name.placeholder = t('tool.markerName');
            name.maxLength = REPLAY_EDIT_LIMITS.label;
            name.setAttribute('aria-label', t('tool.markerName'));
            name.addEventListener('change', () => {
                marker.label = name.value;
                if (player.timeline) {
                    applyEdit(player.timeline);
                }
            });
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'tool-delete';
            remove.textContent = '✕';
            remove.setAttribute('aria-label', t('tool.deleteMarker'));
            remove.addEventListener('click', () =>
                editNow(() => {
                    edit.markers = edit.markers.filter((m) => m !== marker);
                }),
            );
            item.append(jump, name, remove);
            return item;
        }),
    );
}

function highlightMarker(tick: number) {
    if (tick === markerHere) {
        return;
    }
    markerHere = tick;
    for (const item of $('#user-markers').children) {
        item.classList.toggle(
            'here',
            (item as HTMLElement).dataset.tick === String(tick),
        );
    }
}

function toggleMarker() {
    editNow((tick) => {
        const existing = edit.markers.find((marker) => marker.tick === tick);
        if (existing) {
            $('#edit-status').textContent = t('tool.markerExists');
        } else {
            edit.markers = [...edit.markers, { tick, label: '' }];
        }
        $<HTMLDetailsElement>('#marker-list').open = true;
    });
}

function setRangeStart() {
    editNow((tick, timeline) => {
        const end = edit.range?.end ?? timeline.endTick;
        if (end <= tick) {
            $('#edit-status').textContent = t('tool.invalidStart');
            return;
        }
        edit.range = tick < end ? { start: tick, end } : edit.range;
    });
}

function setRangeEnd() {
    editNow((tick, timeline) => {
        const start = edit.range?.start ?? timeline.startTick;
        if (start >= tick) {
            $('#edit-status').textContent = t('tool.invalidEnd');
            return;
        }
        edit.range = start < tick ? { start, end: tick } : edit.range;
    });
}

function toggleRangeLoop() {
    if (edit.range) {
        player.setLoop(!player.loop);
        syncLoop();
    }
}

function fill(list: HTMLElement, facts: Array<[string, string]>) {
    list.replaceChildren(
        ...facts.flatMap(([name, value]) => {
            const dt = document.createElement('dt');
            dt.textContent = name;
            const dd = document.createElement('dd');
            dd.textContent = value;
            return [dt, dd];
        }),
    );
}

function showCommands(tick: number) {
    if (!selected) {
        return;
    }
    const commands = selected.file.commands;
    let next = commands.findIndex(([at]) => at >= tick);
    if (next < 0) {
        next = commands.length;
    }
    const from = Math.max(0, next - 4);
    $('#commands').replaceChildren(
        ...commands.slice(from, next + 8).map(([at, command], i) => {
            const item = document.createElement('li');
            const button = document.createElement('button');
            button.type = 'button';
            const { type, ...rest } = command;
            button.textContent = `${at} · ${type}${Object.keys(rest).length ? ' ' + JSON.stringify(rest) : ''}`;
            if (from + i === next) {
                item.className = 'next';
            }
            button.addEventListener('click', () => {
                player.seek(at);
                player.setPlaying(false);
            });
            item.append(button);
            return item;
        }),
    );
}

let lastShown = -1;
function showState() {
    const state = player.state;
    if (!state || state.tick === lastShown) {
        return;
    }
    lastShown = state.tick;
    const p = state.p;
    const n = (value: number) => value.toFixed(1);
    fill($('#state-info'), [
        ['tick', `${state.tick} · ${state.time.toFixed(2)}s`],
        [
            'mode',
            `${state.mode}${state.lossReason ? ` (${state.lossReason})` : ''}`,
        ],
        ['stage', `${state.stage} · flag ${state.checkpoint}`],
        [
            'player',
            `x ${n(p.x)} y ${n(p.y)} · v ${n(p.vx)}, ${n(p.vy)} · a ${p.a.toFixed(2)}`,
        ],
        ['ground', String(state.ground)],
        ['focus', String(state.focus.value)],
        ['keys', state.keys.join(', ') || '—'],
        ['deaths', String(state.deaths)],
    ]);
    showCommands(state.tick);
    highlightMarker(state.tick);
    syncLoop();
}

$('#open-file').addEventListener('click', () =>
    $<HTMLInputElement>('#file').click(),
);
$<HTMLInputElement>('#file').addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
        file.text()
            .then((text) => load(text, file.name))
            .catch(() => {
                status.textContent = t('replay.badFile');
            });
    }
});
function loadBrowser() {
    const text = loadBrowserData();
    if (text) {
        load(text, t('tool.browserData'));
    } else {
        status.textContent = t('tool.noBrowserData');
    }
}
$('#browser-data').addEventListener('click', loadBrowser);
$('#load-paste').addEventListener('click', () =>
    load($<HTMLTextAreaElement>('#paste').value, t('tool.paste')),
);
sourcesSelect.addEventListener('change', () => {
    const index = Number(sourcesSelect.value);
    const source = index >= 0 ? sources.at(index) : undefined;
    if (source) {
        open(source);
    }
});
document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', (event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file) {
        file.text()
            .then((text) => load(text, file.name))
            .catch(() => {
                status.textContent = t('replay.badFile');
            });
    }
});
$('#download-replay').addEventListener('click', () => {
    if (selected) {
        const { edit: _saved, ...file } = selected.file;
        downloadJson(
            `the-chair-replay-stage${selected.file.start.stage}-${stamp()}.json`,
            edit.markers.length || edit.range ? { ...file, edit } : file,
        );
    }
});
$('#add-marker').addEventListener('click', toggleMarker);
$('#range-start').addEventListener('click', setRangeStart);
$('#range-end').addEventListener('click', setRangeEnd);
$('#range-loop').addEventListener('click', toggleRangeLoop);
$('#range-clear').addEventListener('click', () =>
    editNow(() => {
        edit.range = null;
        player.setLoop(false);
    }),
);
$('#download-clip').addEventListener('click', () => {
    const timeline = player.timeline;
    if (selected && timeline && edit.range) {
        downloadJson(
            `the-chair-replay-stage${selected.file.start.stage}-clip-${stamp()}.json`,
            clipReplay(timeline, edit.range, edit),
        );
    }
});
let copyFeedbackTimer: ReturnType<typeof setTimeout> | undefined;
function showCopyResult(copied: boolean) {
    const message = t(copied ? 'replay.copied' : 'replay.copyFailed');
    $('#edit-status').textContent = message;
    $('#copy-clip').textContent = message;
    clearTimeout(copyFeedbackTimer);
    copyFeedbackTimer = setTimeout(() => {
        $('#copy-clip').textContent = t('tool.copyClip');
    }, 2000);
}
$('#copy-clip').addEventListener('click', () => {
    const timeline = player.timeline;
    if (selected && timeline && edit.range) {
        copyText(
            JSON.stringify(clipReplay(timeline, edit.range, edit), null, 2),
        )
            .then(showCopyResult)
            .catch(() => showCopyResult(false));
    }
});
for (const button of document.querySelectorAll<HTMLButtonElement>(
    '.tool-edit-bar button',
)) {
    button.title =
        button.getAttribute('aria-label') ?? button.textContent.trim();
}
$('#download-clip').setAttribute('aria-label', t('tool.downloadClipLabel'));
$('#download-clip').title = t('tool.downloadClipLabel');
window.addEventListener('keydown', (event) => {
    const target = event.target;
    if (
        !player.timeline ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
    ) {
        return;
    }
    const action: Partial<Record<string, () => void>> = {
        m: toggleMarker,
        i: setRangeStart,
        o: setRangeEnd,
        l: toggleRangeLoop,
    };
    const run = action[event.key.toLowerCase()];
    if (run) {
        event.preventDefault();
        run();
    }
});
$('#copy-state').addEventListener('click', () => {
    if (player.state) {
        copyText(JSON.stringify(player.state, null, 2))
            .then((copied) => {
                status.textContent = t(
                    copied ? 'replay.copied' : 'replay.copyFailed',
                );
            })
            .catch(() => {
                status.textContent = t('replay.copyFailed');
            });
    }
});

let last: number | null = null;
function frame(ms: number) {
    const dt = last === null ? 0 : (ms - last) / 1000;
    last = ms;
    player.advance(dt);
    const view = player.view();
    if (view && renderer) {
        renderer.draw(view, player.effects());
    }
    player.drainEvents();
    showState();
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if (loadBrowserData()) {
    loadBrowser();
}

(window as Window & { replayTool?: unknown }).replayTool = {
    load,
    player,
    sources: () => sources,
};
