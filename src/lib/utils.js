export function formatDateString(dateString) {
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
  
  export const browserIcons = {
    "chrome": "/icons/chrome.svg",
    "edge": "/icons/edge.svg",
    "default": "/icons/chrome.svg"
  }