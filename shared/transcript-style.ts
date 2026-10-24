// Transcript layout from the approved ticket preview.
export const transcriptStyle = String.raw`
@font-face {
  font-family: Manrope;
  src: url("__FONT__") format("woff2");
  font-weight: 200 800;
  font-display: swap;
}
:root {
  color-scheme: dark;
  --bg: #121311;
  --surface: #1a1b18;
  --raised: #22231f;
  --line: #32342d;
  --text: #edeee9;
  --muted: #b0b5a6;
  --orange: #ff9955;
  --green: #afd7aa;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font:
    14px/1.65 Manrope,
    sans-serif;
}
button,
input,
a {
  font: inherit;
}
button,
a {
  touch-action: manipulation;
}
button {
  cursor: pointer;
}
button:disabled {
  cursor: default;
  opacity: 0.62;
}
button:focus-visible,
a:focus-visible,
input:focus-visible {
  outline: 2px solid var(--orange);
  outline-offset: 4px;
}
::selection {
  background: #724321;
  color: white;
}
a {
  color: inherit;
}
svg {
  width: 17px;
  height: 17px;
  flex-shrink: 0;
  vertical-align: middle;
}
button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--raised);
  color: var(--text);
  padding: 8px 14px;
}
button:hover:not(:disabled) {
  background: #2e3029;
}
.primary {
  background: var(--orange);
  border-color: var(--orange);
  color: #2e1a0c;
  font-weight: 750;
}
.primary:hover:not(:disabled) {
  background: #ffb37e;
}
p {
  margin: 0 0 12px;
}
h1,
h2,
h3 {
  margin: 0;
  font-weight: 750;
  line-height: 1.3;
  letter-spacing: -0.025em;
}
h1 {
  font-size: 30px;
}
h2 {
  font-size: 19px;
}
h3 {
  font-size: 15px;
}
.muted,
small {
  color: var(--muted);
}
small {
  font-size: 12px;
}
.skip {
  position: fixed;
  top: 10px;
  left: 12px;
  z-index: 10;
  background: var(--orange);
  color: #121311;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
.skip:focus {
  clip-path: none;
  width: auto;
  height: auto;
  padding: 10px;
}
[hidden] {
  display: none !important;
}
.preview-bar {
  padding: 10px 5%;
  background: #24251e;
  border-bottom: 1px solid #4b4c3d;
  color: #d9dec9;
  font-size: 12px;
}
.preview-bar strong {
  color: #ffc08f;
}
header {
  border-bottom: 1px solid var(--line);
  padding: 18px 5%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}
.brand {
  display: flex;
  gap: 10px;
  align-items: center;
  font-weight: 800;
}
.brand-b {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  background: var(--orange);
  color: #21170e;
  font-weight: 850;
  font-size: 23px;
  border-radius: 9px;
}
.server {
  font-size: 12px;
  color: var(--muted);
}
nav {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
nav button {
  background: transparent;
  border-color: transparent;
}
nav button[aria-pressed="true"] {
  background: #352a20;
  color: #ffc08f;
  border-color: #5e4932;
}
main {
  max-width: 1260px;
  margin: 0 auto;
  padding: 38px 30px 60px;
}
.heading {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 27px;
}
.heading p {
  color: var(--muted);
  margin-top: 9px;
  font-size: 13px;
}
.badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 10px;
  border-radius: 5px;
  background: #283024;
  color: #bdddba;
  font-size: 12px;
  white-space: nowrap;
}
.badge.orange {
  color: #ffc08f;
  background: #352a20;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.demo-help {
  font-size: 12px;
  color: var(--muted);
  margin-top: 18px;
  max-width: 75ch;
}
.log-label h2 {
  font:
    700 13px/1.65 Manrope,
    sans-serif;
  letter-spacing: normal;
}
.log-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 22px;
}
.log-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 13px;
  font-size: 13px;
}
.discord {
  border: 1px solid #3b3c42;
  border-radius: 12px;
  background: #313338;
  padding: 20px;
  color: #f2f3f5;
  font-family: Arial, sans-serif;
}
.discord-channel {
  border-bottom: 1px solid #45464d;
  color: #b5bac1;
  padding: 0 0 12px;
  margin-bottom: 20px;
  font-size: 13px;
}
.discord-message {
  display: flex;
  gap: 12px;
  align-items: start;
}
.avatar {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #4c485f;
  color: #fff;
  font-weight: 750;
  font-size: 12px;
}
.avatar.bot {
  background: #77503a;
  color: #ffe0c4;
}
.avatar.staff {
  background: #485944;
  color: #d8f2d2;
}
.msg-author {
  font-size: 13px;
  display: flex;
  gap: 7px;
  align-items: center;
  flex-wrap: wrap;
}
.bot-tag {
  padding: 1px 4px;
  background: #5865f2;
  color: white;
  border-radius: 3px;
  font:
    10px Arial,
    sans-serif;
}
.msg-author time {
  font-size: 11px;
  color: #b5bac1;
  font-weight: 400;
}
.message-body {
  flex: 1;
  min-width: 0;
}
.embed {
  margin-top: 9px;
  padding: 17px;
  background: #2b2d31;
  border-radius: 4px;
  border-left: 4px solid var(--orange);
  font-size: 13px;
}
.embed.closed {
  border-left-color: #a8cfa3;
}
.embed h3 {
  font:
    700 16px/1.35 Arial,
    sans-serif;
  margin: 9px 0;
}
.embed-owner {
  font-size: 11px;
  color: #c3c7ce;
}
.embed p {
  color: #d7d9dc;
  line-height: 1.6;
}
.embed-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px 12px;
  margin-top: 17px;
}
.embed-fields dt {
  color: #b5bac1;
  font-size: 11px;
  margin-bottom: 4px;
}
.embed-fields dd {
  margin: 0;
  color: #f2f3f5;
  overflow-wrap: anywhere;
}
.mention {
  color: #d4daff;
  background: #3a405f;
  padding: 1px 3px;
  border-radius: 3px;
}
.embed-footer {
  margin-top: 19px;
  padding-top: 12px;
  border-top: 1px solid #41434a;
  font-size: 11px;
  color: #b5bac1;
}
.discord-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 9px;
}
.discord-actions button {
  font:
    12px Arial,
    sans-serif;
  min-height: 33px;
  padding: 6px 10px;
  background: #41434a;
  border-color: transparent;
  color: white;
  border-radius: 4px;
}
.discord-actions .claim {
  background: #5865f2;
}
.discord-actions .claimed {
  background: #414d42;
  color: #d2e5ce;
}
.private-notice {
  margin: 10px 0 0;
  color: #bec4b8;
  font-size: 12px;
}
.rule-list {
  padding: 25px 0 0;
  margin-top: 25px;
  border-top: 1px solid var(--line);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 28px;
}
.rule-list h2 {
  margin-bottom: 10px;
}
.rule-list p {
  font-size: 13px;
  color: var(--muted);
}
.thread-state {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  margin-top: 14px;
  font-size: 12px;
}
.thread-state svg {
  color: var(--green);
}
.thread-state small {
  display: block;
}
.thread-demo {
  margin-top: 12px;
}
.toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  padding-bottom: 25px;
  border-bottom: 1px solid var(--line);
}
.search {
  display: flex;
  gap: 10px;
  align-items: center;
  flex: 1;
  min-width: 220px;
  max-width: 450px;
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 7px 12px;
  color: var(--muted);
}
.search input {
  width: 100%;
  min-width: 0;
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: var(--text);
  outline-offset: 9px;
}
.search-count {
  font-size: 12px;
  color: var(--muted);
  margin-inline-end: auto;
}
.transcript-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 40px;
  padding-top: 28px;
}
.timeline {
  min-width: 0;
}
.date-line {
  display: flex;
  align-items: center;
  gap: 15px;
  color: var(--muted);
  font-size: 11px;
  margin: 0 0 22px;
}
.date-line:before,
.date-line:after {
  content: "";
  height: 1px;
  background: var(--line);
  flex: 1;
}
.chat-message {
  display: flex;
  gap: 12px;
  margin: 0 0 23px;
}
.chat-content {
  min-width: 0;
  flex: 1;
}
.chat-content .msg-author {
  margin-bottom: 6px;
}
.chat-content p {
  font-size: 13px;
  margin: 5px 0;
  line-height: 1.85;
  overflow-wrap: anywhere;
  max-width: 70ch;
}
.chat-content .embed {
  max-width: 530px;
  font:
    13px/1.65 Manrope,
    sans-serif;
  background: #20221e;
  border-color: #93a584;
}
.chat-content .embed h2 {
  font:
    750 14px/1.3 Manrope,
    sans-serif;
  margin: 9px 0;
}
.chat-content .embed dt {
  color: #bec5b1;
}
.chat-content .embed dd {
  color: #edeee9;
}
.event {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 11px;
  color: #bbc4ad;
  margin: 2px 0 22px 48px;
}
.event svg {
  width: 14px;
  height: 14px;
  color: #a1b18b;
}
.attachment {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 11px;
  max-width: 310px;
  margin-top: 12px;
  font-size: 12px;
}
.attachment svg {
  width: 22px;
  height: 22px;
  color: #bfcbb0;
}
.attachment small {
  display: block;
  font-size: 10px;
}
.closing {
  padding: 18px 0;
  border-top: 1px solid var(--line);
  margin: 25px 0 0 48px;
  font-size: 12px;
}
.closing h3 {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 10px;
}
.closing p {
  color: var(--muted);
  margin: 4px 0;
}
.closing strong {
  color: var(--text);
}
aside {
  align-self: start;
  position: sticky;
  top: 25px;
  border-left: 1px solid var(--line);
  padding-left: 24px;
}
aside h2 {
  font-size: 14px;
  margin-bottom: 20px;
}
dl.meta {
  margin: 0;
}
.meta > div {
  margin-bottom: 18px;
}
.meta dt {
  font-size: 11px;
  color: var(--muted);
  margin-bottom: 4px;
}
.meta dd {
  margin: 0;
  font-size: 13px;
  overflow-wrap: anywhere;
}
.privacy {
  display: flex;
  gap: 8px;
  margin-top: 24px;
  font-size: 11px;
  color: var(--muted);
}
.privacy svg {
  width: 15px;
  height: 15px;
}
.no-results {
  padding: 35px 0;
  font-size: 13px;
  color: var(--muted);
}
footer {
  border-top: 1px solid var(--line);
  padding: 20px 0;
  color: var(--muted);
  font-size: 11px;
  margin-top: 25px;
}
.notice {
  min-height: 24px;
  margin-top: 12px;
  color: var(--green);
  font-size: 12px;
}
@media (max-width: 900px) {
  header {
    align-items: start;
    flex-direction: column;
    gap: 14px;
  }
  main {
    padding: 25px 20px 40px;
  }
  .log-grid {
    grid-template-columns: 1fr;
  }
  .transcript-layout {
    grid-template-columns: 1fr;
    gap: 30px;
  }
  aside {
    position: static;
    border-left: 0;
    border-top: 1px solid var(--line);
    padding: 25px 0 0;
  }
  .meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 18px;
  }
  .rule-list {
    grid-template-columns: 1fr;
  }
  .heading {
    flex-wrap: wrap;
    gap: 10px;
  }
  h1 {
    font-size: 25px;
  }
  .toolbar .search {
    max-width: none;
    flex-basis: 100%;
  }
  .toolbar button {
    flex: 1;
  }
  .search-count {
    flex-basis: 100%;
  }
  .embed-fields {
    gap: 15px 10px;
  }
  .discord {
    padding: 15px;
  }
  .discord-message {
    gap: 9px;
  }
  .discord .avatar {
    width: 29px;
    height: 29px;
  }
  .closing,
  .event {
    margin-left: 0;
  }
  .server {
    font-size: 11px;
  }
}
@media print {
  .preview-bar,
  header,
  nav,
  .toolbar,
  .notice,
  .skip {
    display: none !important;
  }
  body {
    background: white;
    color: #111;
  }
  .transcript-layout {
    display: block;
  }
  aside {
    position: static;
    border: 0;
  }
  .chat-content .embed {
    background: #f4f4f4;
    color: #111;
  }
  small,
  .muted,
  .chat-content .embed dt {
    color: #444;
  }
}

.heading > div {
  min-width: 0;
}
.heading h1,
.heading p,
.chat-content .embed {
  overflow-wrap: anywhere;
}
.attachment a {
  min-width: 0;
  overflow-wrap: anywhere;
}
`
