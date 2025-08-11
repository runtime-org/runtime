export function formatDateString(dateString: string) {
  if (typeof dateString !== 'string') {
      throw new TypeError('dateString must be a string');
  }
  const date = new Date(dateString);

  if (isNaN(date.getTime())) {
      return "Invalid Date";
  }

  const day = date.getDate();
  const monthIndex = date.getMonth();
  const year = date.getFullYear();

  let hours = date.getHours(); // (0-23).
  const minutes = date.getMinutes(); // (0-59).
  const seconds = date.getSeconds(); // (0-59).

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const monthName = monthNames[monthIndex]; 

  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;

  const paddedMinutes = minutes < 10 ? '0' + minutes : minutes;
  const paddedSeconds = seconds < 10 ? '0' + seconds : seconds;

  const formattedDate = `${day} ${monthName} ${year} at ${hours}:${paddedMinutes}:${paddedSeconds} ${ampm}`;

  return formattedDate;
}

export const browserIcons: Record<string, string> = {
    "chrome": "/icons/chrome.svg",
    "edge": "/icons/edge.svg",
    "arc": "/icons/arc.svg",
    "default": "/icons/chrome.svg"
}

export function mdToHtml(source: string): string {
  if (!source) return "";

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;")
     .replace(/</g, "&lt;")
     .replace(/>/g, "&gt;");

  const bold = (s: string) =>
    s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  const lines     = source.split(/\r?\n/);
  let html        = "";
  let listStack   = 0;           // how many <ul> are open
  const openUl    = () => { html += "<ul>"; listStack++; };
  const closeUl   = () => { html += "</ul>"; listStack--; };

  const flushListsTo = (level: number) => {
    while (listStack > level) closeUl();
    while (listStack < level) openUl();
  };

  lines.forEach(raw => {
    if (!raw.trim()) {
      flushListsTo(0);
      return;
    }

    const bullet = raw.match(/^(\s*)\*\s+(.*)/);
    if (bullet) {
      const indent = Math.floor(bullet[1].length / 2);
      flushListsTo(indent + 1);
      html += `<li>${bold(esc(bullet[2]))}</li>`;
      return;
    }

    const heading = raw.match(/^(#{1,6})\s+(.*)/);
    if (heading) {
      flushListsTo(0);
      const lvl = heading[1].length;
      html += `<h${lvl}>${bold(esc(heading[2]))}</h${lvl}>`;
      return;
    }

    flushListsTo(0);
    html += `<p>${bold(esc(raw.trim()))}</p>`;
  });

  flushListsTo(0);
  return html;
}
