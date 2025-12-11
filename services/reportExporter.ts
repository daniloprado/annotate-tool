
import { Issue, GeneralIssue } from "../types";

export const generateHtmlReport = (
  issues: Issue[],
  score: number,
  generalIssues: GeneralIssue[],
  designImageSrc: string | null,
  liveImageSrc: string | null
): string => {
  const date = new Date().toLocaleDateString();
  const data = JSON.stringify({ issues });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Design QA Report - ${date}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
      ::-webkit-scrollbar { width: 8px; }
      ::-webkit-scrollbar-track { background: #f1f5f9; }
      ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
      ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      .fade-in { animation: fadeIn 0.3s ease-in; }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  </style>
</head>
<body class="bg-slate-50 text-slate-800 font-sans p-4 sm:p-6 lg:p-8">
  <div class="max-w-[95%] mx-auto">
    
    <!-- Header -->
    <div class="flex flex-col sm:flex-row items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-lg gap-4 mb-8">
        <div>
          <h1 class="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-violet-600 text-transparent bg-clip-text">QA Report</h1>
          <p class="text-slate-500 mt-1">Generated on ${date}</p>
        </div>
        <div class="flex items-center gap-4 bg-slate-50 px-5 py-3 rounded-xl border border-slate-100 shadow-inner">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Match Score</span>
            <span class="text-4xl font-black ${score > 85 ? 'text-green-500' : score > 60 ? 'text-yellow-500' : 'text-red-500'}">${score}%</span>
        </div>
    </div>

    <div class="flex flex-col xl:flex-row gap-6 items-start">
        
        <!-- Images Column -->
        <div class="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <!-- Design -->
            <div class="flex flex-col gap-2">
                 <h3 class="font-bold text-slate-800 text-lg flex items-center gap-2">
                    Design <span class="text-[10px] font-bold text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full uppercase tracking-wide">Expected</span>
                </h3>
                <div class="relative bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm group min-h-[400px]">
                    <img src="${designImageSrc}" class="w-full h-auto block" alt="Design Mockup" />
                    <div id="design-overlays" class="absolute inset-0 pointer-events-none"></div>
                </div>
            </div>

            <!-- Live -->
            <div class="flex flex-col gap-2">
                <h3 class="font-bold text-slate-800 text-lg flex items-center gap-2">
                    Live <span class="text-[10px] font-bold text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full uppercase tracking-wide">Observed</span>
                </h3>
                <div class="relative bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm group min-h-[400px]">
                    <img src="${liveImageSrc}" class="w-full h-auto block" alt="Live Screenshot" />
                    <div id="live-overlays" class="absolute inset-0 pointer-events-none"></div>
                </div>
            </div>

        </div>

        <!-- Sidebar -->
        <div class="w-full xl:w-96 shrink-0 flex flex-col gap-6">
            <div class="bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden flex flex-col sticky top-6 max-h-[calc(100vh-50px)]">
                 <div class="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 class="font-bold text-slate-800 text-lg">Issues Detected <span class="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full ml-2">${issues.length}</span></h3>
                </div>
                <div class="overflow-y-auto p-2 space-y-2" id="issue-list">
                    <!-- Issues injected via JS -->
                </div>
            </div>
            
             <!-- General Issues -->
             ${generalIssues.length > 0 ? `
             <div class="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden p-4">
                <h3 class="font-bold text-slate-800 text-xs uppercase tracking-wide mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                    <span class="text-yellow-500 text-base">⚠</span> General Observations
                </h3>
                <div class="space-y-2">
                    ${generalIssues.map(i => `
                        <div class="text-xs bg-slate-50 p-2.5 rounded border border-slate-100">
                             <div class="font-bold text-slate-700 mb-0.5">${i.category}</div>
                             <div class="text-slate-500">${i.description}</div>
                        </div>
                    `).join('')}
                </div>
             </div>` : ''}

        </div>

    </div>
  </div>

  <script>
    const data = ${data};
    const designOverlays = document.getElementById('design-overlays');
    const liveOverlays = document.getElementById('live-overlays');
    const issueList = document.getElementById('issue-list');

    function getStyle(box) {
        if(!box || (box[0]===0 && box[1]===0 && box[2]===0 && box[3]===0)) return 'display: none;';
        return \`top: \${box[0]/10}%; left: \${box[1]/10}%; height: \${(box[2]-box[0])/10}%; width: \${(box[3]-box[1])/10}%;\`;
    }

    function createArrow(issueId, box, color, idx) {
        const [y1, x1, y2, x2] = box;
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("class", "absolute inset-0 w-full h-full pointer-events-none overflow-visible z-20 issue-annotation-" + issueId);
        svg.setAttribute("viewBox", "0 0 1000 1000");
        svg.setAttribute("preserveAspectRatio", "none");

        const defs = document.createElementNS(svgNS, "defs");
        const marker = document.createElementNS(svgNS, "marker");
        marker.setAttribute("id", \`arrowhead-\${issueId}-\${Math.random()}\`); // Unique ID just in case
        marker.setAttribute("markerWidth", "6");
        marker.setAttribute("markerHeight", "4");
        marker.setAttribute("refX", "5");
        marker.setAttribute("refY", "2");
        marker.setAttribute("orient", "auto");
        const poly = document.createElementNS(svgNS, "polygon");
        poly.setAttribute("points", "0 0, 6 2, 0 4");
        poly.setAttribute("fill", color);
        marker.appendChild(poly);
        defs.appendChild(marker);
        svg.appendChild(defs);
        const markerId = marker.getAttribute("id");

        const line = document.createElementNS(svgNS, "line");
        line.setAttribute("x1", x1);
        line.setAttribute("y1", y1);
        line.setAttribute("x2", x2);
        line.setAttribute("y2", y2);
        line.setAttribute("stroke", color);
        line.setAttribute("stroke-width", "3");
        line.setAttribute("marker-end", \`url(#\${markerId})\`);
        line.setAttribute("class", "pointer-events-auto cursor-pointer transition-all duration-200");
        
        line.addEventListener('mouseenter', () => highlight(issueId));
        line.addEventListener('mouseleave', () => unhighlight(issueId));
        
        svg.appendChild(line);

        const fo = document.createElementNS(svgNS, "foreignObject");
        fo.setAttribute("x", x1 - 10);
        fo.setAttribute("y", y1 - 10);
        fo.setAttribute("width", "24");
        fo.setAttribute("height", "24");
        fo.innerHTML = \`<div class="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm \${color === '#22c55e' ? 'bg-green-500' : 'bg-red-500'}" id="arrow-badge-\${issueId}">\${idx + 1}</div>\`;
        svg.appendChild(fo);

        return svg;
    }

    function createBox(issueId, box, color, idx) {
        const el = document.createElement('div');
        el.className = \`absolute border-2 \${color === '#22c55e' ? 'border-green-500/0' : 'border-red-500/0'} transition-all duration-200 z-20 issue-annotation-\${issueId}\`;
        el.style = getStyle(box);
        el.innerHTML = \`<div class="absolute -top-3 -right-3 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm \${color === '#22c55e' ? 'bg-green-600' : 'bg-red-600'} opacity-0 transition-opacity transform scale-75 annotation-badge">\${idx + 1}</div>\`;
        el.addEventListener('mouseenter', () => highlight(issueId));
        el.addEventListener('mouseleave', () => unhighlight(issueId));
        return el;
    }

    data.issues.forEach((issue, idx) => {
        // Render List Item
        const item = document.createElement('div');
        item.className = 'group p-3 rounded-lg cursor-pointer transition-all duration-200 border border-transparent hover:bg-slate-50 hover:border-slate-100 bg-white relative overflow-hidden';
        item.innerHTML = \`
            <div class="flex gap-3 relative z-10">
                <span class="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold bg-slate-100 text-slate-500 group-hover:bg-slate-200 transition-all duration-200" id="badge-\${issue.id}">\${idx + 1}</span>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold text-slate-800 truncate" id="title-\${issue.id}">\${issue.title}</p>
                    <div class="flex items-center gap-2 mt-1.5">
                         <span class="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border \${issue.severity === 'High' ? 'bg-red-50 text-red-600 border-red-100' : issue.severity === 'Medium' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' : 'bg-blue-50 text-blue-600 border-blue-100'}">\${issue.severity}</span>
                    </div>
                    <div class="mt-2 hidden text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100" id="desc-\${issue.id}">
                        <p class="mb-2">\${issue.description}</p>
                        <div class="grid grid-cols-1 gap-2">
                             <div class="bg-white p-2 rounded border border-slate-200"><span class="text-[10px] font-bold text-green-600 uppercase">Expected:</span> \${issue.designReference}</div>
                             <div class="bg-white p-2 rounded border border-red-100"><span class="text-[10px] font-bold text-red-600 uppercase">Observed:</span> \${issue.liveObservation}</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 opacity-0 transition-opacity" id="accent-\${issue.id}"></div>
        \`;
        
        item.addEventListener('mouseenter', () => highlight(issue.id));
        item.addEventListener('mouseleave', () => unhighlight(issue.id));
        item.addEventListener('click', () => {
            const desc = document.getElementById('desc-' + issue.id);
            desc.classList.toggle('hidden');
        });

        issueList.appendChild(item);

        // Render Design Annotations
        if (issue.designAnnotations) {
             issue.designAnnotations.forEach(ann => {
                 if (ann.type === 'arrow') {
                     const arrow = createArrow(issue.id, ann.coords, '#22c55e', idx);
                     designOverlays.appendChild(arrow);
                 } else {
                     const box = createBox(issue.id, ann.coords, '#22c55e', idx);
                     designOverlays.appendChild(box);
                 }
             });
        }

        // Render Live Annotations
        if (issue.liveAnnotations) {
            issue.liveAnnotations.forEach(ann => {
                if (ann.type === 'arrow') {
                     const arrow = createArrow(issue.id, ann.coords, '#ef4444', idx);
                     liveOverlays.appendChild(arrow);
                } else {
                     const box = createBox(issue.id, ann.coords, '#ef4444', idx);
                     liveOverlays.appendChild(box);
                }
            });
        }
    });

    function highlight(id) {
        // Highlight logic needs to select all elements with the specific class
        const elements = document.querySelectorAll('.issue-annotation-' + id);
        elements.forEach(el => {
            if (el.tagName === 'DIV') { // Box
                if (el.classList.contains('border-green-500/0')) {
                    el.classList.remove('border-green-500/0');
                    el.classList.add('border-green-500', 'bg-green-500/20', 'shadow-[0_0_15px_rgba(34,197,94,0.6)]');
                } else if (el.classList.contains('border-red-500/0')) {
                    el.classList.remove('border-red-500/0');
                    el.classList.add('border-red-500', 'bg-red-500/20', 'shadow-[0_0_15px_rgba(239,68,68,0.6)]');
                }
                const badge = el.querySelector('.annotation-badge');
                if(badge) {
                    badge.classList.remove('opacity-0', 'scale-75');
                    badge.classList.add('scale-125');
                }
            } else if (el.tagName === 'svg') { // Arrow
                const line = el.querySelector('line');
                if(line) line.setAttribute('stroke-width', '5');
                const badge = el.querySelector('foreignObject div');
                if(badge) badge.classList.add('scale-125');
            }
        });

        // List Item
        const badge = document.getElementById('badge-' + id);
        if(badge) {
             badge.classList.remove('bg-slate-100', 'text-slate-500');
             badge.classList.add('bg-blue-600', 'text-white', 'scale-110');
        }
        const title = document.getElementById('title-' + id);
        if(title) title.classList.add('text-blue-900');
        
        const accent = document.getElementById('accent-' + id);
        if(accent) accent.classList.remove('opacity-0');
    }

    function unhighlight(id) {
         const elements = document.querySelectorAll('.issue-annotation-' + id);
         elements.forEach(el => {
            if (el.tagName === 'DIV') { // Box
                if (el.classList.contains('border-green-500')) {
                    el.classList.add('border-green-500/0');
                    el.classList.remove('border-green-500', 'bg-green-500/20', 'shadow-[0_0_15px_rgba(34,197,94,0.6)]');
                } else if (el.classList.contains('border-red-500')) {
                     el.classList.add('border-red-500/0');
                    el.classList.remove('border-red-500', 'bg-red-500/20', 'shadow-[0_0_15px_rgba(239,68,68,0.6)]');
                }
                const badge = el.querySelector('.annotation-badge');
                if(badge) {
                    badge.classList.add('opacity-0', 'scale-75');
                    badge.classList.remove('scale-125');
                }
            } else if (el.tagName === 'svg') { // Arrow
                const line = el.querySelector('line');
                if(line) line.setAttribute('stroke-width', '3');
                const badge = el.querySelector('foreignObject div');
                if(badge) badge.classList.remove('scale-125');
            }
         });

        // List Item
         const badge = document.getElementById('badge-' + id);
        if(badge) {
             badge.classList.add('bg-slate-100', 'text-slate-500');
             badge.classList.remove('bg-blue-600', 'text-white', 'scale-110');
        }
        const title = document.getElementById('title-' + id);
        if(title) title.classList.remove('text-blue-900');
        
        const accent = document.getElementById('accent-' + id);
        if(accent) accent.classList.add('opacity-0');
    }
  </script>
</body>
</html>`;
};
