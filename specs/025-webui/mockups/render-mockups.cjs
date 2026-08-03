const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const WIDTH = 1990;
const HEIGHT = 1248;

const nav = [
  ["overview", "Overview", "Overview"],
  ["inbox", "Inbox", "Inbox"],
  ["intake", "New Task", "New Task"],
  ["projects", "Project", "Project"],
  ["settings", "Settings", "Settings"],
  ["sessions", "Recent Sessions", "Recent Sessions"],
];

function css() {
  return `
    :root {
      --bg: #dedfe4;
      --rail: #d5d6dc;
      --sheet: #e9eaee;
      --panel: #eceef2;
      --panel-2: #e2e4e9;
      --line: #c6c8d0;
      --line-soft: #d3d5dc;
      --ink: #18191d;
      --muted: #666a73;
      --faint: #8a8e97;
      --blue: #2474d4;
      --green: #2a9d69;
      --amber: #b97717;
      --red: #c64c4c;
      --radius: 8px;
      --mono: "SF Mono", ui-monospace, Menlo, Monaco, Consolas, monospace;
      --sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: ${WIDTH}px;
      height: ${HEIGHT}px;
      overflow: hidden;
      background: var(--bg);
      color: var(--ink);
      font-family: var(--sans);
      letter-spacing: 0;
    }
    .window {
      width: ${WIDTH}px;
      height: ${HEIGHT}px;
      display: grid;
      grid-template-columns: 405px 1fr;
      background: var(--sheet);
      border: 1px solid #b8bac2;
      border-radius: 16px;
      overflow: hidden;
    }
    .rail {
      background: var(--rail);
      border-right: 1px solid #b9bbc3;
      padding: 18px 10px 20px 18px;
      display: flex;
      flex-direction: column;
      gap: 22px;
    }
    .traffic { display: flex; gap: 10px; height: 22px; align-items: center; }
    .dot { width: 16px; height: 16px; border-radius: 50%; border: 1px solid rgba(0,0,0,.18); }
    .red { background: #ff5f57; } .yellow { background: #febc2e; } .green { background: #28c840; }
    .railTitle { padding: 8px 8px 0; }
    .railTitle h1 { margin: 0; font-size: 19px; font-weight: 650; }
    .railTitle p { margin: 8px 0 0; color: var(--muted); font-size: 14px; line-height: 1.45; }
    .navGroup, .projectGroup, .bottomGroup { display: grid; gap: 4px; }
    .navItem {
      display: grid;
      grid-template-columns: 28px 1fr auto;
      align-items: center;
      min-height: 36px;
      padding: 6px 10px;
      border-radius: var(--radius);
      color: #30333a;
      font-size: 15px;
    }
    .navItem.active { background: #c4c6cd; }
    .navItem .ico {
      width: 17px;
      height: 17px;
      border: 1.4px solid #555963;
      border-radius: 5px;
      display: inline-block;
      position: relative;
    }
    .navItem .ico.round { border-radius: 50%; }
    .navItem .ico.line::after { content: ""; position: absolute; left: 3px; right: 3px; top: 7px; height: 1.4px; background: #555963; }
    .badgeMini { min-width: 22px; height: 22px; border-radius: 999px; background: #b9bbc4; display: inline-grid; place-items: center; font-size: 13px; color: #2e3137; }
    .railLabel { padding: 0 10px; color: var(--muted); font-size: 14px; font-weight: 600; }
    .projectRow { padding-left: 10px; display: flex; align-items: center; gap: 9px; height: 34px; color: #4f535c; font-size: 15px; }
    .folder { width: 18px; height: 13px; border: 1.3px solid #747983; border-radius: 3px; position: relative; }
    .folder::before { content: ""; position: absolute; left: 1px; top: -5px; width: 9px; height: 5px; border: 1.3px solid #747983; border-bottom: 0; border-radius: 3px 3px 0 0; }
    .bottomGroup { margin-top: auto; }
    .main {
      background: var(--sheet);
      min-width: 0;
      display: grid;
      grid-template-rows: 56px 1fr;
    }
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 12px 0 28px;
      color: #33363d;
      font-size: 15px;
    }
    .crumb { display: flex; align-items: center; gap: 10px; font-weight: 600; }
    .topActions { display: flex; align-items: center; gap: 8px; }
    .iconButton, .textButton, .blackButton {
      border: 1px solid var(--line);
      border-radius: 999px;
      height: 34px;
      padding: 0 13px;
      background: #e2e3e8;
      color: #22242a;
      font: inherit;
      font-size: 14px;
      display: inline-flex;
      align-items: center;
      gap: 7px;
    }
    .iconButton { width: 34px; padding: 0; justify-content: center; }
    .blackButton { background: #111216; color: #fff; border-color: #111216; }
    .content { position: relative; overflow: hidden; }
    .center {
      width: min(860px, calc(100% - 540px));
      margin: 0 auto;
      padding-top: 74px;
    }
    .center.inspectorAware {
      width: 860px;
      margin-left: max(96px, calc((100% - 438px - 860px) / 2));
      margin-right: 0;
    }
    .wideCenter {
      width: min(1080px, calc(100% - 460px));
      margin: 0 auto;
      padding-top: 40px;
    }
    .filterRow {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
    }
    .filterButton {
      height: 34px;
      padding: 0 14px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: #e2e3e8;
      color: #2a2d34;
      font: inherit;
      font-size: 14px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .caret {
      width: 7px;
      height: 7px;
      border-right: 1.5px solid #5f6470;
      border-bottom: 1.5px solid #5f6470;
      transform: rotate(45deg) translateY(-1px);
    }
    .pageTitle { margin: 0 0 28px; text-align: center; font-size: 34px; font-weight: 560; }
    .pageTitle.left { text-align: left; margin-bottom: 18px; }
    .subhead { color: var(--muted); font-size: 16px; margin: -16px 0 24px; line-height: 1.5; }
    .composer {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 16px;
      box-shadow: 0 12px 30px rgba(0,0,0,.06);
    }
    .composerText {
      min-height: 138px;
      padding: 6px 0;
      font-size: 15px;
      line-height: 1.65;
      color: #25272d;
    }
    .composerFooter, .toolbarRow {
      display: flex;
      align-items: center;
      gap: 10px;
      justify-content: space-between;
      border-top: 1px solid var(--line-soft);
      padding-top: 12px;
    }
    .leftTools, .rightTools { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .pill {
      height: 28px;
      padding: 0 10px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #d9dbe1;
      color: #333740;
      font-size: 13px;
      white-space: nowrap;
    }
    .pill.blue { background: #d8e6fa; color: #1f5ea9; }
    .pill.green { background: #d9eee4; color: #26724f; }
    .pill.amber { background: #f2e5cf; color: #8c5a11; }
    .pill.red { background: #f1d9d9; color: #9e3535; }
    .pill.dark { background: #1f2025; color: #fff; }
    .ghostInput {
      height: 38px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: #e6e7eb;
      color: var(--muted);
      padding: 0 14px;
      display: flex;
      align-items: center;
      min-width: 280px;
    }
    .section { margin-top: 34px; }
    .section h2, .section h3 { margin: 0 0 12px; font-size: 20px; font-weight: 650; }
    .hairline { border-top: 1px solid var(--line-soft); }
    .grid { display: grid; gap: 12px; }
    .grid.two { grid-template-columns: 1fr 1fr; }
    .grid.three { grid-template-columns: repeat(3, 1fr); }
    .panel {
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--panel);
      padding: 16px;
    }
    .metricValue {
      font-size: 30px;
      font-weight: 650;
      margin: 8px 0 2px;
      letter-spacing: 0;
    }
    .delta {
      color: var(--muted);
      font-size: 13px;
    }
    .spark {
      height: 48px;
      display: flex;
      align-items: flex-end;
      gap: 5px;
      margin-top: 16px;
    }
    .spark span {
      flex: 1;
      min-width: 8px;
      border-radius: 4px 4px 0 0;
      background: #c8d3e4;
    }
    .spark span.good { background: #b8dec9; }
    .spark span.bad { background: #e1bebf; }
    .stageBar {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
      gap: 4px;
      height: 44px;
      margin: 18px 0 14px;
    }
    .stageBar span {
      border-radius: 6px;
      background: #d7d9df;
      position: relative;
      overflow: hidden;
    }
    .stageBar span::after {
      content: "";
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: var(--w);
      background: #aeb9cb;
    }
    .trendPanel {
      height: 286px;
      display: grid;
      grid-template-rows: auto 1fr;
    }
    .compositionPanel {
      height: 286px;
      display: grid;
      grid-template-rows: auto 1fr;
    }
    .compositionBody {
      display: grid;
      grid-template-rows: auto 1fr;
      min-height: 0;
    }
    .chartBars {
      display: grid;
      grid-template-columns: repeat(14, 1fr);
      align-items: end;
      gap: 8px;
      padding-top: 18px;
      height: 190px;
      border-top: 1px solid var(--line-soft);
    }
    .barStack {
      height: var(--h);
      min-height: 18px;
      border-radius: 5px 5px 0 0;
      overflow: hidden;
      display: grid;
      grid-template-rows: var(--s) var(--f) 1fr;
      background: #d7d9df;
    }
    .barStack .s { background: #a9d7bd; }
    .barStack .f { background: #dfb5b7; }
    .barStack .q { background: #c6d2e4; }
    .topicGrid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
      margin-top: 14px;
    }
    .topicCard {
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--panel);
      padding: 13px;
      min-height: 116px;
    }
    .topicCard h4 { margin: 0 0 10px; font-size: 15px; }
    .topicCard strong { display: block; font-size: 20px; margin-bottom: 6px; }
    .toplistGrid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-top: 12px;
    }
    .topItem {
      display: grid;
      grid-template-columns: 22px minmax(0, 1fr);
      gap: 8px;
      align-items: start;
      padding: 10px 0;
      border-top: 1px solid var(--line-soft);
      font-size: 14px;
    }
    .topItem:first-child { border-top: 0; }
    .topMain {
      min-width: 0;
      display: grid;
      gap: 8px;
      padding-top: 1px;
    }
    .topLabel {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      min-width: 0;
    }
    .topLabel strong {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .barTrack {
      width: 100%;
      height: 8px;
      border-radius: 999px;
      background: #d7d9df;
      overflow: hidden;
    }
    .barFill {
      height: 100%;
      border-radius: 999px;
      background: #b8dec9;
    }
    .barFill.rose { background: #dfb5b7; }
    .barFill.blue { background: #b7c8e1; }
    .barFill.slate { background: #b9bec9; }
    .rank {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #d9dbe1;
      display: grid;
      place-items: center;
      color: var(--muted);
      font-size: 12px;
    }
    .durationStack {
      display: flex;
      width: 100%;
      height: 52px;
      border-radius: 7px;
      overflow: hidden;
      background: #d8dae0;
      margin: 18px 0 18px;
    }
    .durationStack span { height: 100%; }
    .durationStack .queue { width: 14%; background: #bcc8da; }
    .durationStack .execution { width: 62%; background: #9fb5d2; }
    .durationStack .delivery { width: 16%; background: #b8dec9; }
    .durationStack .final { width: 8%; background: #d8c8a9; }
    .panelHeader { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
    .panelHeader h3, .panelHeader h4 { margin: 0 0 4px; font-size: 16px; }
    .muted { color: var(--muted); font-size: 14px; line-height: 1.45; }
    .tiny { color: var(--faint); font-size: 12px; line-height: 1.4; }
    .kv {
      display: grid;
      grid-template-columns: 132px 1fr;
      gap: 12px;
      padding: 9px 0;
      border-top: 1px solid var(--line-soft);
      font-size: 14px;
    }
    .kv:first-child { border-top: 0; }
    .kv span { color: var(--muted); }
    .kv strong { font-family: var(--mono); font-size: 13px; font-weight: 550; overflow-wrap: anywhere; }
    .rightInspector {
      position: absolute;
      right: 0;
      top: 0;
      bottom: 0;
      width: 438px;
      border-left: 1px solid var(--line);
      background: rgba(226,228,234,.72);
      padding: 80px 24px 24px;
    }
    .inspectorTitle { margin: 0 0 18px; font-size: 18px; color: var(--muted); font-weight: 600; }
    .listRows { display: grid; gap: 8px; }
    .row {
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 12px;
      background: #e9eaee;
      display: grid;
      gap: 8px;
    }
    .rowTop { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
    .rowTop strong { font-size: 15px; }
    .mono { font-family: var(--mono); font-size: 13px; }
    .detailLayout {
      display: grid;
      grid-template-columns: 340px minmax(0, 1fr) 360px;
      height: 100%;
      border-top: 1px solid transparent;
    }
    .sideList, .detailMain, .settingsNav {
      padding: 26px;
      overflow: hidden;
    }
    .sideList { border-right: 1px solid var(--line); }
    .detailMain { padding-top: 32px; }
    .rightPane { border-left: 1px solid var(--line); padding: 32px 26px; background: rgba(226,228,234,.64); }
    .sessionCard {
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 14px;
      background: var(--panel);
      display: grid;
      gap: 8px;
      margin-bottom: 10px;
    }
    .sessionCard.active { background: #e1e4eb; }
    .timeline { display: grid; gap: 12px; margin-top: 18px; }
    .step {
      display: grid;
      grid-template-columns: 18px 1fr auto;
      gap: 12px;
      align-items: start;
      padding: 13px 0;
      border-top: 1px solid var(--line-soft);
    }
    .node {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      margin-top: 4px;
      background: var(--green);
      box-shadow: 0 0 0 4px #d9eee4;
    }
    .node.current { background: var(--blue); box-shadow: 0 0 0 4px #d8e6fa; }
    .node.wait { background: #a2a6af; box-shadow: 0 0 0 4px #dcdee4; }
    .step h4 { margin: 0 0 4px; font-size: 15px; }
    .settingsLayout {
      display: grid;
      grid-template-columns: 260px minmax(0, 760px) 360px;
      gap: 24px;
      width: 1380px;
      margin: 0 auto;
      padding-top: 44px;
    }
    .settingsNav {
      padding: 0;
      display: grid;
      align-content: start;
      gap: 4px;
    }
    .settingsItem {
      height: 36px;
      border-radius: var(--radius);
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 0 12px;
      color: #3e424a;
      font-size: 15px;
    }
    .settingsItem.active { background: #d3d5dc; }
    .formGrid { display: grid; gap: 12px; }
    .field { border: 1px solid var(--line); background: #e6e7ec; border-radius: var(--radius); padding: 11px 12px; }
    .field label { display: block; color: var(--muted); font-size: 12px; margin-bottom: 6px; }
    .field strong { font-family: var(--mono); font-size: 14px; font-weight: 520; overflow-wrap: anywhere; }
    .skillHero {
      height: 320px;
      border-radius: var(--radius);
      border: 1px solid #bcc3d0;
      background:
        radial-gradient(circle at 30% 20%, rgba(255,255,255,.7), transparent 28%),
        linear-gradient(135deg, #cfd8e8, #dadde7 48%, #c9cedc);
      display: grid;
      place-items: center;
      margin-bottom: 30px;
    }
    .heroPill { background: rgba(231,233,239,.86); border: 1px solid rgba(80,85,98,.22); border-radius: 999px; padding: 13px 18px; font-weight: 620; }
    .skillRow {
      display: grid;
      grid-template-columns: 52px 1fr auto;
      align-items: center;
      gap: 12px;
      padding: 13px 10px;
      border-top: 1px solid var(--line-soft);
    }
    .appIcon {
      width: 44px; height: 44px; border-radius: 8px; border: 1px solid var(--line);
      background: linear-gradient(135deg, #eef0f5, #d2d7e3);
      display: grid; place-items: center; font-weight: 700; color: #4f5666;
    }
    .overlayDim {
      position: absolute; inset: 0; background: rgba(70,72,80,.25); backdrop-filter: blur(1px);
    }
    .modal {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 920px;
      height: 620px;
      border: 1px solid #bdc0c8;
      border-radius: 20px;
      background: #eceef2;
      box-shadow: 0 24px 60px rgba(0,0,0,.16);
      padding: 28px 24px 20px;
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 18px;
    }
    .modal h2 { margin: 0; font-size: 20px; }
    .modalBody { display: grid; grid-template-columns: 1fr 310px; gap: 18px; overflow: hidden; }
    .tabs { display: flex; gap: 6px; margin-bottom: 12px; }
    .tab { height: 32px; padding: 0 12px; border-radius: 999px; display: inline-flex; align-items: center; background: #d9dbe1; font-size: 14px; }
    .tab.active { background: #1d1e23; color: #fff; }
    .textarea {
      height: 150px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: #e6e8ed;
      padding: 12px;
      color: #333740;
      font-size: 14px;
      line-height: 1.55;
    }
    .modalFooter { display: flex; justify-content: space-between; align-items: center; }
    .contactSheet { width: 100%; height: 100%; background: var(--sheet); padding: 30px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
    .thumb { border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel); padding: 12px; }
    .thumb img { width: 100%; border-radius: 6px; border: 1px solid var(--line-soft); }
  `;
}

function rail(active) {
  const navItems = nav.map(([key, label, en], index) => `
    <div class="navItem ${active === key ? "active" : ""}">
      <span class="ico ${index % 2 === 0 ? "round" : "line"}"></span>
      <span>${label}</span>
      ${key === "sessions" ? '<span class="badgeMini">3</span>' : ""}
    </div>
  `).join("");
  return `
    <aside class="rail">
      <div class="traffic"><span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span></div>
      <div class="railTitle">
        <h1>Mystra</h1>
        <p>Agent-first control plane for coding work.</p>
      </div>
      <div class="navGroup">${navItems}</div>
      <div class="projectGroup">
        <div class="railLabel">项目</div>
        <div class="projectRow"><span class="folder"></span><span>mystra</span></div>
        <div class="projectRow"><span class="folder"></span><span>skrya</span></div>
        <div class="projectRow"><span class="folder"></span><span>managed-skills</span></div>
      </div>
      <div class="projectGroup">
        <div class="railLabel">最近运行</div>
        <div class="projectRow"><span class="ico round"></span><span>implementation request</span></div>
        <div class="projectRow"><span class="ico round"></span><span>user journey</span></div>
      </div>
      <div class="bottomGroup">
        <div class="navItem ${active === "settings" ? "active" : ""}">
          <span class="ico round"></span><span>设置</span>
        </div>
      </div>
    </aside>
  `;
}

function shell(active, title, body, actions = null) {
  return `<!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=${WIDTH}, initial-scale=1" />
        <style>${css()}</style>
        <title>${title}</title>
      </head>
      <body>
        <div class="window">
          ${rail(active)}
          <main class="main">
            <div class="topbar">
              <div class="crumb">${title}</div>
              <div class="topActions">${actions ?? ""}</div>
            </div>
            <section class="content">${body}</section>
          </main>
        </div>
      </body>
    </html>`;
}

function overviewDashboard() {
  return shell("overview", "Overview", `
    <div class="wideCenter" style="width: min(1320px, calc(100% - 180px)); padding-top:48px;">
      <div class="filterRow">
        <button class="filterButton">7 days <span class="caret"></span></button>
        <button class="filterButton">All projects <span class="caret"></span></button>
      </div>
      <div class="grid" style="grid-template-columns: repeat(4, 1fr);">
        <div class="panel">
          <div class="muted">Tasks</div>
          <div class="metricValue">128</div>
          <div class="delta">104 terminal sessions</div>
          <div class="spark"><span style="height:38%"></span><span style="height:45%"></span><span class="good" style="height:52%"></span><span style="height:41%"></span><span class="good" style="height:70%"></span><span style="height:62%"></span><span class="good" style="height:82%"></span></div>
        </div>
        <div class="panel">
          <div class="muted">Success rate</div>
          <div class="metricValue">82%</div>
          <div class="delta">11 failed / 3 timed out</div>
          <div class="spark"><span class="good" style="height:64%"></span><span class="good" style="height:74%"></span><span class="bad" style="height:28%"></span><span class="good" style="height:76%"></span><span class="good" style="height:79%"></span><span class="bad" style="height:34%"></span><span class="good" style="height:88%"></span></div>
        </div>
        <div class="panel">
          <div class="muted">Time to artifact</div>
          <div class="metricValue">43m</div>
          <div class="delta">91 reviewable sessions</div>
          <div class="spark"><span style="height:80%"></span><span style="height:68%"></span><span style="height:62%"></span><span class="good" style="height:50%"></span><span class="good" style="height:45%"></span><span style="height:58%"></span><span class="good" style="height:42%"></span></div>
        </div>
        <div class="panel">
          <div class="muted">LLM cost</div>
          <div class="metricValue">$18.40</div>
          <div class="delta">$0.19 per success</div>
          <div class="spark"><span style="height:42%"></span><span style="height:48%"></span><span style="height:50%"></span><span style="height:63%"></span><span style="height:66%"></span><span class="bad" style="height:82%"></span><span style="height:58%"></span></div>
        </div>
      </div>

      <div class="grid" style="grid-template-columns: 1.6fr 1fr; margin-top:12px;">
        <div class="panel trendPanel">
          <div class="panelHeader"><div><h3>Tasks</h3></div></div>
          <div class="chartBars">
            ${[44,58,40,65,82,76,92,70,84,60,88,96,74,86].map((h, i) => `<div class="barStack" style="--h:${h}%;--s:${55 + (i % 4) * 6}%;--f:${12 + (i % 3) * 5}%"><span class="s"></span><span class="f"></span><span class="q"></span></div>`).join("")}
          </div>
        </div>
        <div class="panel compositionPanel">
          <div class="panelHeader"><div><h3>Session time composition</h3></div></div>
          <div class="compositionBody">
            <div class="durationStack"><span class="queue"></span><span class="execution"></span><span class="delivery"></span><span class="final"></span></div>
            <div>
              <div class="kv"><span>Queue wait</span><strong>14%</strong></div>
              <div class="kv"><span>Runner execution</span><strong>62%</strong></div>
              <div class="kv"><span>Artifact delivery</span><strong>16%</strong></div>
              <div class="kv"><span>Finalization</span><strong>8%</strong></div>
            </div>
          </div>
        </div>
      </div>

      <div class="toplistGrid">
        ${toplist("Projects", [["mystra", "74 tasks", 100], ["skrya", "38 tasks", 51], ["managed-skills", "16 tasks", 22]], "green")}
        ${toplist("Failures", [["runtime", "6 sessions", 100], ["artifact delivery", "4 sessions", 67], ["timeout", "3 sessions", 50]], "rose")}
        ${toplist("Models", [["gpt-5.4", "$11.20", 100], ["gpt-5.5", "$5.60", 50], ["local", "$1.60", 14]], "blue")}
        ${toplist("Runners", [["debian-01", "42m", 100], ["local-fake", "9m", 21], ["debian-02", "0m", 4]], "slate")}
      </div>
    </div>
  `);
}

function toplist(title, rows, tone = "green") {
  return `<div class="panel">
    <div class="panelHeader"><div><h3>${title}</h3></div></div>
    ${rows.map(([label, value, width], index) => `<div class="topItem"><span class="rank">${index + 1}</span><div class="topMain"><div class="topLabel"><strong>${label}</strong><span class="mono">${value}</span></div><div class="barTrack"><div class="barFill ${tone}" style="width:${width}%"></div></div></div></div>`).join("")}
  </div>`;
}

function intake() {
  return shell("intake", "新工作", `
    ${commandBackdrop()}
    <div class="overlayDim"></div>
    <div class="modal">
      <div class="panelHeader">
        <div><h2>New Task</h2><p class="muted">先保存长期目标；执行由后续显式 Session 承担。</p></div>
        <span class="pill">private ops</span>
      </div>
      <div class="modalBody">
        <section>
          <div class="grid two">
            <div class="field"><label>Project</label><strong>mystra</strong></div>
            <div class="field"><label>Repository</label><strong>Arcadia822/mystra</strong></div>
          </div>
          <div style="height:12px"></div>
          <div class="textarea">
            Objective: migrate the operator experience to Task and Session.<br />
            Acceptance: Task remains valid without execution; child Sessions are independent.
          </div>
        </section>
        <aside class="panel">
          <div class="panelHeader"><div><h3>Task contract</h3><p class="muted">Durable intent only</p></div><span class="pill green">ready</span></div>
          <div class="kv"><span>Project</span><strong>inherited context</strong></div>
          <div class="kv"><span>Sessions</span><strong>0 initially</strong></div>
          <div class="kv"><span>Agent / branch</span><strong>selected per Session</strong></div>
          <div class="kv"><span>Task state</span><strong>none</strong></div>
        </aside>
      </div>
      <div class="modalFooter">
        <div class="leftTools"><span class="pill">HTTP API truth</span><span class="pill blue">MCP wrapper available</span></div>
        <div class="rightTools"><button class="textButton">取消</button><button class="blackButton">Create Task</button></div>
      </div>
    </div>
  `, '<button class="blackButton">Create Task</button>');
}

function commandBackdrop() {
  return `
    <div class="wideCenter" style="opacity:.7">
      <h1 class="pageTitle">要让 Mystra 执行什么？</h1>
      <div class="grid two">
        <div class="panel" style="height:180px"></div>
        <div class="panel" style="height:180px"></div>
        <div class="panel" style="height:180px"></div>
        <div class="panel" style="height:180px"></div>
      </div>
    </div>`;
}

function sessionDetail() {
  return shell("sessions", "Session > task_81f2 / session_4ad9", `
    <div class="detailLayout">
      <aside class="sideList">
        <h2 class="inspectorTitle">Recent Sessions</h2>
        <div class="sessionCard active"><div class="rowTop"><strong>compact-summary-ui</strong><span class="pill blue">running</span></div><p class="muted">mystra / codex / runner-debian-01</p></div>
        <div class="sessionCard"><div class="rowTop"><strong>skill-status-polish</strong><span class="pill green">succeeded</span></div><p class="muted">mystra / codex</p></div>
        <div class="sessionCard"><div class="rowTop"><strong>skrya eval digest</strong><span class="pill">queued</span></div><p class="muted">skrya / codex</p></div>
      </aside>
      <section class="detailMain">
        <h1 class="pageTitle left">Implement Task / Session UI</h1>
        <p class="subhead">This Session owns its objective, Agent, branch, lifecycle, and result.</p>
        <div class="grid three">
          <div class="panel"><span class="muted">Task</span><h3 class="mono">task_81f2</h3></div>
          <div class="panel"><span class="muted">Session</span><h3 class="mono">session_4ad9</h3></div>
          <div class="panel"><span class="muted">Updated</span><h3>1 分钟前</h3></div>
        </div>
        <div class="panel" style="margin-top:18px">
          <div class="panelHeader"><div><h3>Result</h3><p class="muted">No public activity timeline is defined.</p></div><span class="pill blue">running</span></div>
          <div class="kv"><span>Summary</span><strong>Result not ready</strong></div>
          <div class="kv"><span>Review</span><strong>pending</strong></div>
        </div>
      </section>
      <aside class="rightPane">
        <h2 class="inspectorTitle">详情</h2>
        <div class="kv"><span>Project</span><strong>mystra</strong></div>
        <div class="kv"><span>Runtime</span><strong>docker / mystra-runner:local</strong></div>
        <div class="kv"><span>Context</span><strong>agent-skills, issue-brief</strong></div>
        <div class="kv"><span>Agent</span><strong>codex</strong></div>
        <div class="kv"><span>Branch</span><strong>codex/task-session-ui</strong></div>
        <div class="kv"><span>Terminal</span><strong>not ready</strong></div>
        <div style="height:18px"></div>
        <div class="panel">
          <div class="panelHeader"><div><h3>Artifact links</h3><p class="muted">Only real links are shown.</p></div></div>
          <span class="pill">branch pending</span>
          <span class="pill" style="margin-left:6px">PR pending</span>
        </div>
      </aside>
    </div>
  `, '<button class="iconButton">Ⅱ</button><button class="iconButton">⌫</button><button class="blackButton">Cancel Session</button>');
}

function projectConfig() {
  return shell("projects", "项目配置", `
    <div class="settingsLayout">
      <nav class="settingsNav">
        <div class="settingsItem active">mystra</div>
        <div class="settingsItem">skrya</div>
        <div class="settingsItem">managed-skills</div>
        <div class="settingsItem">Archived lanes</div>
      </nav>
      <section>
        <h1 class="pageTitle left">mystra project lane</h1>
        <p class="subhead">Project owns repository identity, runtime defaults, and context bundles.</p>
        <div class="formGrid">
          <div class="panel">
            <div class="panelHeader"><div><h3>Repository</h3><p class="muted">Selection view for API, MCP, CLI and UI.</p></div><span class="pill green">active</span></div>
            <div class="grid two"><div class="field"><label>Repo</label><strong>arcadia822/mystra</strong></div><div class="field"><label>Base branch</label><strong>main</strong></div></div>
          </div>
          <div class="panel">
            <div class="panelHeader"><div><h3>Runtime</h3><p class="muted">Runner executes resolved contract, not mutable project fields.</p></div><span class="pill">docker</span></div>
            <div class="grid two">
              <div class="field"><label>Image</label><strong>ghcr.io/arcadia/mystra-runner:latest</strong></div>
              <div class="field"><label>Override policy</label><strong>image: false / context additions: true</strong></div>
              <div class="field"><label>Mounts</label><strong>workspace, gitMirror, contextBundle</strong></div>
              <div class="field"><label>Cache</label><strong>pnpm store, cold start allowed</strong></div>
            </div>
          </div>
          <div class="panel">
            <div class="panelHeader"><div><h3>Context bundles</h3><p class="muted">Explicit context, never source-owned accidental truth.</p></div></div>
            <div class="leftTools"><span class="pill blue">agent-skills</span><span class="pill blue">repo-instructions</span><span class="pill">issue-brief</span></div>
          </div>
        </div>
      </section>
      <aside class="rightPane" style="border-left:0">
        <h2 class="inspectorTitle">验证</h2>
        <div class="row"><div class="rowTop"><strong>Lane isolation</strong><span class="pill green">ok</span></div><p class="muted">Sessions remain attributable to mystra.</p></div>
        <div class="row"><div class="rowTop"><strong>Secret refs</strong><span class="pill">refs only</span></div><p class="muted">Values are injected at runtime; no UI reveal.</p></div>
        <div class="row"><div class="rowTop"><strong>Runner eligibility</strong><span class="pill blue">docker</span></div><p class="muted">runner-debian-01 advertises compatible provider.</p></div>
      </aside>
    </div>
  `, '<button class="textButton">归档</button><button class="blackButton">保存</button>');
}

function skillsMcp() {
  return shell("settings", "技能与 MCP", `
    <div class="center inspectorAware" style="padding-top:40px">
      <h1 class="pageTitle">让 agent 按 Mystra 的方式工作</h1>
      <div class="toolbarRow" style="border-top:0;padding-top:0;margin-bottom:18px">
        <div class="ghostInput">搜索技能、MCP tool 或 transport</div>
        <div class="rightTools"><span class="pill">Built by Mystra</span><span class="pill">全部</span></div>
      </div>
      <div class="skillHero"><div class="heroPill">mystra-submit-implementation-request 将 spec/task 包装成 task</div></div>
      <div class="section">
        <h2>Featured</h2>
        <div class="hairline"></div>
        <div class="grid two">
          ${skillRow("IR", "mystra-submit-implementation-request", "Submit spec, plan and task scope through MCP.", "已启用")}
          ${skillRow("UJ", "mystra-submit-user-journey", "Package actor, goal and acceptance criteria.", "+")}
          ${skillRow("JS", "mystra-check-task-status", "Retrieve compact human-readable task status.", "已启用")}
          ${skillRow("MCP", "Mystra MCP endpoint", "/api/mcp streamable HTTP tools/list.", "复制")}
        </div>
      </div>
    </div>
    <aside class="rightInspector">
      <h2 class="inspectorTitle">Endpoint</h2>
      <div class="kv"><span>Transport</span><strong>streamable-http</strong></div>
      <div class="kv"><span>Path</span><strong>/api/mcp</strong></div>
      <div class="kv"><span>Tools</span><strong>mystra_create_task, mystra_create_session, mystra_get_session, mystra_list_runners</strong></div>
      <div style="height:18px"></div>
      <div class="panel"><div class="panelHeader"><div><h3>Skill policy</h3><p class="muted">Skills package intent. API remains truth.</p></div></div><span class="pill blue">API -> MCP -> CLI -> UI</span></div>
    </aside>
  `, '<button class="textButton">管理</button><button class="blackButton">创建连接</button>');
}

function skillRow(icon, title, desc, action) {
  return `<div class="skillRow">
    <div class="appIcon">${icon}</div>
    <div><strong>${title}</strong><p class="muted" style="margin:4px 0 0">${desc}</p></div>
    <span class="pill ${action === "已启用" ? "green" : ""}">${action}</span>
  </div>`;
}

function platformSettings() {
  return shell("settings", "平台配置", `
    <div class="settingsLayout">
      <nav class="settingsNav">
        <div class="settingsItem active">Runner pool</div>
        <div class="settingsItem">Sandbox provider</div>
        <div class="settingsItem">Management surfaces</div>
        <div class="settingsItem">Theme</div>
        <div class="settingsItem">Trust boundary</div>
      </nav>
      <section>
        <h1 class="pageTitle left">平台配置</h1>
        <p class="subhead">Platform owns shared providers and resource pools. Project owns execution defaults.</p>
        <div class="formGrid">
          <div class="panel">
            <div class="panelHeader"><div><h3>Runner pool</h3><p class="muted">Pull-based runners initiate outbound connections.</p></div><span class="pill green">1 online</span></div>
            <div class="grid two">
              <div class="field"><label>Default stale window</label><strong>45 seconds</strong></div>
              <div class="field"><label>Max concurrency</label><strong>2 per runner</strong></div>
              <div class="field"><label>Eligible projects</label><strong>mystra, skrya</strong></div>
              <div class="field"><label>Provider families</label><strong>docker, fake</strong></div>
            </div>
          </div>
          <div class="panel">
            <div class="panelHeader"><div><h3>Management surfaces</h3><p class="muted">Completion is not accepted when a core capability exists only in UI.</p></div></div>
            <div class="grid two">
              <div class="field"><label>HTTP API</label><strong>product truth</strong></div>
              <div class="field"><label>Skill / MCP</label><strong>agent runtime surface</strong></div>
              <div class="field"><label>CLI</label><strong>operator shell surface</strong></div>
              <div class="field"><label>UI</label><strong>inspection and configuration</strong></div>
            </div>
          </div>
          <div class="panel">
            <div class="panelHeader"><div><h3>Theme token mood</h3><p class="muted">Codex-inspired calm desktop, owned by Mystra design tokens.</p></div><span class="pill">light</span></div>
            <div class="leftTools"><span class="pill">neutral gray</span><span class="pill blue">small blue accent</span><span class="pill green">status green</span><span class="pill amber">warning amber</span></div>
          </div>
        </div>
      </section>
      <aside class="rightPane" style="border-left:0">
        <h2 class="inspectorTitle">边界</h2>
        <div class="row"><div class="rowTop"><strong>Private ops</strong><span class="pill amber">MVP</span></div><p class="muted">Caller auth is explicitly out of scope.</p></div>
        <div class="row"><div class="rowTop"><strong>No logs API</strong><span class="pill">by design</span></div><p class="muted">Use the Session result and review evidence.</p></div>
        <div class="row"><div class="rowTop"><strong>No retry API</strong><span class="pill">deferred</span></div><p class="muted">Avoid hidden quality-gate fix loops in MVP.</p></div>
      </aside>
    </div>
  `, '<button class="textButton">导出配置</button><button class="blackButton">保存</button>');
}

const pages = [
  ["Overview", overviewDashboard(), path.join(ROOT, "page-designs/screenshots/01-overview.png")],
  ["New Task", intake(), path.join(ROOT, "page-designs/screenshots/02-new-work-intake.png")],
  ["Recent Sessions", sessionDetail(), path.join(ROOT, "page-designs/screenshots/03-session-detail.png")],
  ["Project", projectConfig(), path.join(ROOT, "page-designs/screenshots/04-project-config.png")],
  ["Settings / Skills MCP", skillsMcp(), path.join(ROOT, "page-designs/screenshots/05-skills-mcp.png")],
  ["Settings / Platform", platformSettings(), path.join(ROOT, "page-designs/screenshots/06-platform-settings.png")],
];

async function main() {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_EXECUTABLE_PATH
      ? { executablePath: process.env.CHROME_EXECUTABLE_PATH }
      : {}),
  });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });

  const indexParts = [];
  for (const [title, html, screenshotPath] of pages) {
    await page.setContent(html, { waitUntil: "networkidle" });
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: false });
    const imagePath = path.relative(__dirname, screenshotPath);
    indexParts.push(`<section><h2>${title}</h2><img src="${imagePath}" /></section>`);
  }

  await browser.close();
  const indexHtml = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#e6e7eb;margin:0;padding:24px}section{margin:0 0 28px}img{width:100%;max-width:995px;border:1px solid #c4c7cf;border-radius:8px}</style></head><body>${indexParts.join("")}</body></html>`;
  await fs.writeFile(path.join(__dirname, "index.html"), indexHtml);
  console.log(`Rendered ${pages.length} screenshots to page spec directories under ${ROOT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
