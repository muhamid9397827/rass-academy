// Presentation only. Access checks and data permissions remain in the existing app.
(() => {
 'use strict';
 const sidebar=document.getElementById('portalSidebar');
 const toggle=document.getElementById('mobileMenuToggle');
 const close=document.getElementById('mobileMenuClose');
 const backdrop=document.getElementById('mobileMenuBackdrop');
 const bottom=document.getElementById('mobileBottomNav');
 const more=document.getElementById('mobileMore');
 const media=window.matchMedia('(max-width: 950px)');
 let workspace=false,opened=false,returnFocus=null,currentPage=null;
 function sync(){
  sidebar.inert=media.matches&&!opened;
  document.body.classList.toggle('mobile-workspace',workspace);
  document.body.classList.toggle('mobile-menu-open',media.matches&&opened);
  backdrop.hidden=!(workspace&&media.matches&&opened);
  toggle.hidden=!workspace;bottom.hidden=!workspace;
  toggle.setAttribute('aria-expanded',String(opened));more.setAttribute('aria-expanded',String(opened));
  toggle.setAttribute('aria-label',opened?'إغلاق قائمة الأقسام':'فتح قائمة الأقسام');
 }
 function closeMenu(restore=false){opened=false;sync();if(restore&&returnFocus?.isConnected)returnFocus.focus()}
 function openMenu(){if(!workspace||!media.matches)return;returnFocus=document.activeElement;opened=true;sync();close.focus()}
 toggle.onclick=()=>opened?closeMenu(true):openMenu();more.onclick=openMenu;
 close.onclick=()=>closeMenu(true);backdrop.onclick=()=>closeMenu(true);
 media.addEventListener('change',()=>closeMenu());
 document.addEventListener('keydown',e=>{
  if(!opened)return;
  if(e.key==='Escape'){e.preventDefault();closeMenu(true);return;}
  if(e.key!=='Tab')return;
  const nodes=[...sidebar.querySelectorAll('button:not(:disabled),a[href]')].filter(el=>el.getClientRects().length);
  const first=nodes[0],last=nodes.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}
 });
 bottom.querySelectorAll('[data-mobile-page]').forEach(button=>button.onclick=()=>{
  const target=sidebar.querySelector('[data-page="'+button.dataset.mobilePage+'"]');target?.click();
 });
 // Keep real table headings available to assistive tech, while presenting each
 // record as a labelled card on phones. Observe only rendered content changes.
 const page=document.getElementById('page');
 function labelTables(){
  page.querySelectorAll('table').forEach(table=>{
   const headings=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim());
   if(!headings.length)return;
   table.classList.add('mobile-record-table');
   table.setAttribute('role','table');
   table.querySelectorAll('thead,tbody').forEach(group=>group.setAttribute('role','rowgroup'));
   table.querySelectorAll('tr').forEach(row=>row.setAttribute('role','row'));
   table.querySelectorAll('th').forEach(cell=>cell.setAttribute('role','columnheader'));
   table.querySelectorAll('tbody tr').forEach(row=>[...row.cells].forEach((cell,i)=>{
    cell.setAttribute('role','cell');
    const label=cell.colSpan>1?'':headings[i]||'';
    if(cell.dataset.label!==label)cell.dataset.label=label;
   }));
  });
 }
 new MutationObserver(labelTables).observe(page,{childList:true,subtree:true});
 window.ASF_MOBILE=Object.freeze({
  setWorkspace(value){workspace=value;closeMenu()},closeMenu,
  setPage(name){
   if(currentPage!==name&&media.matches)window.scrollTo({top:0,behavior:'instant'});
   currentPage=name;more.classList.toggle('active',!['dashboard','reports','compose'].includes(name));
   bottom.querySelectorAll('[data-mobile-page]').forEach(button=>{
   const active=button.dataset.mobilePage===name;button.classList.toggle('active',active);
   if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  });}
 });
 sync();labelTables();
})();
