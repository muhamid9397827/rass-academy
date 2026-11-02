// Isolate the public training view to Security of Facilities only without altering legacy course data.
(() => {
 if (!window.COURSES) return;
 Object.keys(window.COURSES).forEach(key=>{if(window.COURSES[key].sector!=='facilities_security')delete window.COURSES[key];});
 try {sessionStorage.setItem('rp-academy-v2:selected-sector','facilities_security')} catch {}
})();
