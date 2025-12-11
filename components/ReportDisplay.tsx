
import React, { useState, useRef, useEffect } from 'react';
import { AnalysisResult, Issue, Annotation } from '../types';
import { EditIcon } from './icons/EditIcon';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { CheckIcon } from './icons/CheckIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { RectangleIcon } from './icons/RectangleIcon';
import { ArrowIcon } from './icons/ArrowIcon';
import { generateHtmlReport } from '../services/reportExporter';

interface ReportDisplayProps {
  result: AnalysisResult;
  designImageSrc: string | null;
  liveImageSrc: string | null;
}

export const ReportDisplay: React.FC<ReportDisplayProps> = ({ result, designImageSrc, liveImageSrc }) => {
  const [issues, setIssues] = useState<Issue[]>(result.specificIssues);
  
  // Interaction State
  const [hoveredIssueId, setHoveredIssueId] = useState<string | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [hoveredAnnotation, setHoveredAnnotation] = useState<{ id: string, index: number, type: 'design' | 'live' } | null>(null);
  
  // Edit State (Local to specific issue)
  const [editingIssueId, setEditingIssueId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Issue>>({});
  
  // Drawing State
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragStart, setDragStart] = useState<{ x: number, y: number, type: 'design' | 'live' } | null>(null);
  const [currentDrag, setCurrentDrag] = useState<{ x: number, y: number } | null>(null);

  // Sync with prop result only if it changes (new analysis)
  useEffect(() => {
    setIssues(result.specificIssues);
  }, [result]);

  // Handle escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
          if (editingIssueId) {
             cancelEdit();
          } else {
             setSelectedIssueId(null);
          }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [editingIssueId]);

  // --- Helper Functions ---

  const getStyleFromBox = (box: [number, number, number, number]) => {
    const [ymin, xmin, ymax, xmax] = box;
    // Safety check for empty boxes
    if (ymin === 0 && xmin === 0 && ymax === 0 && xmax === 0) return { display: 'none' };
    
    return {
      top: `${ymin / 10}%`,
      left: `${xmin / 10}%`,
      height: `${(ymax - ymin) / 10}%`,
      width: `${(xmax - xmin) / 10}%`,
    };
  };

  const getCropStyle = (issue: Issue, imageSrc: string | null, type: 'design' | 'live', zoomLevel = 300) => {
    if (!imageSrc) return {};
    
    // Fallback to first annotation or 0,0,0,0
    const annotations = type === 'design' ? issue.designAnnotations : issue.liveAnnotations;
    const box = annotations.length > 0 ? annotations[0].coords : [0,0,0,0];

    const [y1, x1, y2, x2] = box;
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);

    const centerX = (minX + maxX) / 2 / 10; // 0-100
    const centerY = (minY + maxY) / 2 / 10; // 0-100
    
    return {
      backgroundImage: `url(${imageSrc})`,
      backgroundPosition: `${centerX}% ${centerY}%`,
      backgroundSize: `${zoomLevel}%`,
      backgroundRepeat: 'no-repeat',
    };
  };

  // --- Export Logic ---
  const handleExport = () => {
    if (!designImageSrc || !liveImageSrc) return;
    const html = generateHtmlReport(issues, result.score, result.generalIssues, designImageSrc, liveImageSrc);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `design-qa-report-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- Drawing Logic ---

  const handleMouseDown = (e: React.MouseEvent, type: 'design' | 'live') => {
    if (!editingIssueId) return; // Only allow drawing if editing an issue
    
    // Determine the container bounds
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setDragStart({ x, y, type });
    setCurrentDrag({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragStart) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Clamp values to container
    const clampedX = Math.max(0, Math.min(x, rect.width));
    const clampedY = Math.max(0, Math.min(y, rect.height));

    setCurrentDrag({ x: clampedX, y: clampedY });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!dragStart || !currentDrag) return;

    const rect = e.currentTarget.getBoundingClientRect();
    
    // Convert to 0-1000 scale
    const rawX1 = dragStart.x;
    const rawY1 = dragStart.y;
    const rawX2 = currentDrag.x;
    const rawY2 = currentDrag.y;

    // Small threshold to prevent incidental clicks from creating tiny boxes
    if (Math.abs(rawX1 - rawX2) < 5 && Math.abs(rawY1 - rawY2) < 5) {
        setDragStart(null);
        setCurrentDrag(null);
        return;
    }

    const startX = (rawX1 / rect.width) * 1000;
    const startY = (rawY1 / rect.height) * 1000;
    const endX = (rawX2 / rect.width) * 1000;
    const endY = (rawY2 / rect.height) * 1000;

    let newCoords: [number, number, number, number];
    const annType = editForm.annotationType || 'box';

    // If Arrow: [y1, x1, y2, x2] (Start -> End)
    if (annType === 'arrow') {
        newCoords = [startY, startX, endY, endX];
    } else {
        // If Box: [ymin, xmin, ymax, xmax]
        newCoords = [
            Math.min(startY, endY),
            Math.min(startX, endX),
            Math.max(startY, endY),
            Math.max(startX, endX)
        ];
    }

    const newAnnotation: Annotation = {
        type: annType,
        coords: newCoords
    };

    // Update the temp edit state by appending to the array
    if (dragStart.type === 'design') {
        setEditForm(prev => ({ 
            ...prev, 
            designAnnotations: [...(prev.designAnnotations || []), newAnnotation] 
        }));
    } else {
        setEditForm(prev => ({ 
            ...prev, 
            liveAnnotations: [...(prev.liveAnnotations || []), newAnnotation] 
        }));
    }

    setDragStart(null);
    setCurrentDrag(null);
  };

  const deleteAnnotation = (type: 'design' | 'live', index: number) => {
      if (type === 'design') {
          setEditForm(prev => ({
              ...prev,
              designAnnotations: (prev.designAnnotations || []).filter((_, i) => i !== index)
          }));
      } else {
          setEditForm(prev => ({
              ...prev,
              liveAnnotations: (prev.liveAnnotations || []).filter((_, i) => i !== index)
          }));
      }
      setHoveredAnnotation(null);
  };

  // --- CRUD Operations ---

  const startEdit = (issue: Issue) => {
    // If we are already editing another issue, cancel it (which handles cleanup if it was new)
    if (editingIssueId && editingIssueId !== issue.id) {
        cancelEdit();
    }

    setEditingIssueId(issue.id);
    setEditForm({
        ...issue,
        // Ensure arrays exist and clone them
        liveAnnotations: [...(issue.liveAnnotations || [])],
        designAnnotations: [...(issue.designAnnotations || [])]
    });
    setSelectedIssueId(null); 
  };

  const createIssue = () => {
    const newId = Date.now().toString();
    const newIssue: Issue = {
        id: newId,
        title: "New Issue",
        description: "Describe the issue...",
        liveAnnotations: [],
        designAnnotations: [],
        designReference: "Expected behavior...",
        liveObservation: "Observed behavior...",
        suggestion: "Suggested fix...",
        severity: "Medium",
        annotationType: 'box'
    };
    setIssues([newIssue, ...issues]);
    startEdit(newIssue);
  };

  const deleteIssue = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (window.confirm("Are you sure you want to delete this issue?")) {
        setIssues(issues.filter(i => i.id !== id));
        if (editingIssueId === id) cancelEdit();
    }
  };

  const saveEdit = () => {
    if (!editingIssueId) return;
    setIssues(issues.map(i => i.id === editingIssueId ? { ...i, ...editForm } as Issue : i));
    setEditingIssueId(null);
    setEditForm({});
  };

  const cancelEdit = () => {
    // If it was a new unsaved issue (checking if it has empty arrays and default text)
    // We check the issues state, not the editForm, because we want to see if the ORIGINAL issue was empty/new
    const originalIssue = issues.find(i => i.id === editingIssueId);
    if (originalIssue && originalIssue.liveAnnotations.length === 0 && originalIssue.designAnnotations.length === 0 && originalIssue.title === "New Issue") {
        setIssues(issues.filter(i => i.id !== editingIssueId));
    }
    setEditingIssueId(null);
    setEditForm({});
  };

  const selectedIssue = issues.find(i => i.id === selectedIssueId);

  // --- Components for Rendering Annotations ---

  const renderAnnotation = (issue: Issue, isDesign: boolean, annotation: Annotation, idx: number, annIndex: number) => {
    const isEditingThis = editingIssueId === issue.id;
    // Always visible, but visual style changes if editing
    const isVisible = true;
    const type = annotation.type;
    const colorClass = isDesign ? 'green' : 'red';
    const colorHex = isDesign ? '#22c55e' : '#ef4444'; 
    const editColorHex = '#8b5cf6'; // violet-500
    
    // Check if THIS specific annotation is hovered in edit mode to show delete state
    const isThisAnnotationHovered = isEditingThis && hoveredAnnotation?.id === issue.id && hoveredAnnotation?.index === annIndex && hoveredAnnotation?.type === (isDesign ? 'design' : 'live');

    if (!annotation.coords || !isVisible) return null;
    const [c1, c2, c3, c4] = annotation.coords;
    if (c1===0 && c2===0 && c3===0 && c4===0) return null;

    // --- Arrow Rendering ---
    if (type === 'arrow') {
        const [y1, x1, y2, x2] = annotation.coords;
        // If editing this specific annotation (hovering to delete), turn it red/danger color
        const strokeColor = isThisAnnotationHovered 
            ? '#ef4444' // Red for delete
            : isEditingThis 
                ? editColorHex 
                : (hoveredIssueId === issue.id ? colorHex : `${colorHex}66`);

        return (
            <div key={`${isDesign ? 'design' : 'live'}-${issue.id}-${annIndex}`} className="absolute inset-0 w-full h-full pointer-events-none z-20">
                <svg 
                    className="absolute inset-0 w-full h-full overflow-visible"
                    viewBox="0 0 1000 1000"
                    preserveAspectRatio="none"
                >
                    <defs>
                        <marker 
                            id={`arrowhead-${isDesign ? 'design' : 'live'}-${issue.id}-${annIndex}`} 
                            markerWidth="6" 
                            markerHeight="4" 
                            refX="5" 
                            refY="2" 
                            orient="auto"
                        >
                            <polygon points="0 0, 6 2, 0 4" fill={strokeColor} />
                        </marker>
                    </defs>
                    <line 
                        x1={x1} y1={y1} x2={x2} y2={y2} 
                        stroke={strokeColor} 
                        strokeWidth={isThisAnnotationHovered ? "6" : "3"} 
                        markerEnd={`url(#arrowhead-${isDesign ? 'design' : 'live'}-${issue.id}-${annIndex})`}
                        className={`pointer-events-auto cursor-pointer transition-all duration-200 ${hoveredIssueId === issue.id ? 'stroke-[5px]' : ''}`}
                        onMouseEnter={() => {
                            if (!editingIssueId) setHoveredIssueId(issue.id);
                            if (isEditingThis) setHoveredAnnotation({ id: issue.id, index: annIndex, type: isDesign ? 'design' : 'live' });
                        }}
                        onMouseLeave={() => {
                            if (!editingIssueId) setHoveredIssueId(null);
                            if (isEditingThis) setHoveredAnnotation(null);
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (isEditingThis) {
                                deleteAnnotation(isDesign ? 'design' : 'live', annIndex);
                            } else if (!editingIssueId) {
                                setSelectedIssueId(issue.id);
                            }
                        }}
                    />
                    {/* Badge at start of arrow */}
                    <foreignObject x={x1 - 10} y={y1 - 10} width="24" height="24" className="pointer-events-none overflow-visible">
                         {isThisAnnotationHovered ? (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white bg-red-600 shadow-md scale-110">
                                <XMarkIcon className="w-4 h-4" />
                            </div>
                        ) : (
                            <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm transition-transform duration-200 
                                ${isEditingThis ? 'bg-violet-600 scale-110' : hoveredIssueId === issue.id ? `bg-${colorClass}-600 scale-125` : `bg-${colorClass}-500 scale-100`}`}>
                                {idx + 1}
                            </div>
                        )}
                    </foreignObject>
                </svg>
                {/* Delete tooltip for Arrow */}
                {isThisAnnotationHovered && (
                     <div 
                        className="absolute bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg pointer-events-none z-50 whitespace-nowrap"
                        style={{ left: `${x1/10}%`, top: `${(y1/10) - 4}%` }}
                     >
                        Click to Remove
                     </div>
                )}
            </div>
        );
    }

    // --- Box Rendering ---
    return (
        <React.Fragment key={`${isDesign ? 'design' : 'live'}-${issue.id}-${annIndex}`}>
            <div 
                className={`absolute border-2 transition-all duration-200 z-20 flex items-center justify-center
                    ${isThisAnnotationHovered
                        ? 'border-red-500 bg-red-500/20 cursor-pointer'
                        : isEditingThis 
                            ? 'border-violet-500 bg-violet-500/20 border-dashed cursor-pointer' 
                            : hoveredIssueId === issue.id 
                                ? `border-${colorClass}-500 bg-${colorClass}-500/20 shadow-[0_0_15px_rgba(${isDesign?'34,197,94':'239,68,68'},0.6)] cursor-pointer` 
                                : `border-${colorClass}-500/40 cursor-pointer`
                    }`}
                style={getStyleFromBox(annotation.coords)}
                onMouseEnter={() => {
                    if (!editingIssueId) setHoveredIssueId(issue.id);
                    if (isEditingThis) setHoveredAnnotation({ id: issue.id, index: annIndex, type: isDesign ? 'design' : 'live' });
                }}
                onMouseLeave={() => {
                    if (!editingIssueId) setHoveredIssueId(null);
                    if (isEditingThis) setHoveredAnnotation(null);
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    if (isEditingThis) {
                        deleteAnnotation(isDesign ? 'design' : 'live', annIndex);
                    } else if (!editingIssueId) {
                        setSelectedIssueId(issue.id);
                    }
                }}
            >
                {/* Badge Corner */}
                <div className={`absolute -top-3 -right-3 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm transition-transform duration-200 
                    ${isThisAnnotationHovered ? 'bg-red-600 scale-125' : isEditingThis ? 'bg-violet-600 scale-110' : hoveredIssueId === issue.id ? `bg-${colorClass}-600 scale-125` : `bg-${colorClass}-500 scale-100`}`}>
                    {isThisAnnotationHovered ? <XMarkIcon className="w-3.5 h-3.5" /> : idx + 1}
                </div>

                {/* Remove Label on Hover */}
                {isThisAnnotationHovered && (
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg pointer-events-none whitespace-nowrap">
                        Remove
                     </div>
                )}

                {/* Tooltip for non-edit mode */}
                {!editingIssueId && hoveredIssueId === issue.id && !selectedIssueId && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-max max-w-[200px] bg-slate-900 text-white p-2 rounded text-xs shadow-xl z-50 pointer-events-none text-center">
                        {issue.title}
                    </div>
                )}
            </div>
        </React.Fragment>
    );
  };


  return (
    <div className="space-y-6 pb-12 w-full">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-lg gap-4">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-violet-600 text-transparent bg-clip-text">
            QA Report
          </h2>
          <p className="text-slate-500 mt-1">
            <span className="font-bold text-slate-800">{issues.length}</span> specific issues found.
          </p>
        </div>
        <div className="flex items-center gap-4">
            {/* Export Button */}
            <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-cyan-600 transition-colors"
                title="Download HTML Report"
            >
                <DownloadIcon className="w-5 h-5" />
                Export
            </button>

            <div className="hidden sm:flex items-center gap-4 bg-slate-50 px-5 py-3 rounded-xl border border-slate-100 shadow-inner">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Match Score</span>
                <span className={`text-4xl font-black ${result.score > 85 ? 'text-green-500' : result.score > 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                    {result.score}%
                </span>
            </div>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 items-start w-full">
        
        {/* LEFT COLUMN: Visual Comparison */}
        <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-4" ref={containerRef}>
            
            {/* Design Image Panel */}
            <div className="flex flex-col gap-2">
                <h3 className="font-bold text-slate-800 text-lg flex items-center justify-between">
                   <div className="flex items-center gap-2">
                     Design <span className="text-[10px] font-bold text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full uppercase tracking-wide">Expected</span>
                   </div>
                   {editingIssueId && (
                       <span className="text-xs text-violet-600 font-medium animate-pulse">
                           {editForm.annotationType === 'arrow' ? 'Draw arrows to add' : 'Draw boxes to add'}
                       </span>
                   )}
                </h3>
                <div 
                    className={`relative bg-white rounded-xl overflow-visible border border-slate-200 shadow-sm group min-h-[400px] select-none
                        ${editingIssueId ? 'cursor-crosshair ring-2 ring-violet-400 ring-offset-2' : ''}
                    `}
                    onMouseDown={(e) => handleMouseDown(e, 'design')}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={() => { if (dragStart) { setDragStart(null); setCurrentDrag(null); } }}
                >
                     {designImageSrc ? (
                         <div className="relative">
                            <img src={designImageSrc} className="w-full h-auto block rounded-xl pointer-events-none" alt="Design Mockup" />
                            
                            {/* Render Issues */}
                            {issues.map((issue, idx) => {
                                const isEditingThis = editingIssueId === issue.id;
                                const annotations = isEditingThis ? (editForm.designAnnotations || []) : issue.designAnnotations;
                                return annotations.map((ann, annIdx) => 
                                    renderAnnotation(isEditingThis ? editForm as Issue : issue, true, ann, idx, annIdx)
                                );
                            })}

                            {/* Drag Preview Overlay */}
                            {dragStart?.type === 'design' && currentDrag && (
                                editForm.annotationType === 'arrow' ? (
                                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-50">
                                         <defs>
                                            <marker id="temp-arrow-design" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                                                <polygon points="0 0, 6 2, 0 4" fill="#8b5cf6" />
                                            </marker>
                                        </defs>
                                        <line 
                                            x1={dragStart.x} y1={dragStart.y} 
                                            x2={currentDrag.x} y2={currentDrag.y} 
                                            stroke="#8b5cf6" 
                                            strokeWidth="3"
                                            strokeDasharray="5,5"
                                            markerEnd="url(#temp-arrow-design)"
                                        />
                                    </svg>
                                ) : (
                                    <div 
                                        className="absolute border-2 border-violet-500 bg-violet-500/30 z-50 pointer-events-none"
                                        style={{
                                            left: Math.min(dragStart.x, currentDrag.x),
                                            top: Math.min(dragStart.y, currentDrag.y),
                                            width: Math.abs(currentDrag.x - dragStart.x),
                                            height: Math.abs(currentDrag.y - dragStart.y)
                                        }}
                                    ></div>
                                )
                            )}
                         </div>
                     ) : <div className="h-full flex items-center justify-center text-slate-400">No Design Image</div>}
                </div>
            </div>

            {/* Live Image Panel */}
             <div className="flex flex-col gap-2">
                <h3 className="font-bold text-slate-800 text-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        Live <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full uppercase tracking-wide">Observed</span>
                    </div>
                    {editingIssueId && (
                       <span className="text-xs text-violet-600 font-medium animate-pulse">
                          {editForm.annotationType === 'arrow' ? 'Draw arrows to add' : 'Draw boxes to add'}
                       </span>
                   )}
                </h3>
                <div 
                    className={`relative bg-white rounded-xl overflow-visible border border-slate-200 shadow-sm group min-h-[400px] select-none
                        ${editingIssueId ? 'cursor-crosshair ring-2 ring-violet-400 ring-offset-2' : ''}
                    `}
                    onMouseDown={(e) => handleMouseDown(e, 'live')}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={() => { if (dragStart) { setDragStart(null); setCurrentDrag(null); } }}
                >
                     {liveImageSrc ? (
                         <div className="relative">
                            <img src={liveImageSrc} className="w-full h-auto block rounded-xl pointer-events-none" alt="Live Screenshot" />
                            
                             {/* Render Issues */}
                            {issues.map((issue, idx) => {
                                const isEditingThis = editingIssueId === issue.id;
                                const annotations = isEditingThis ? (editForm.liveAnnotations || []) : issue.liveAnnotations;
                                return annotations.map((ann, annIdx) => 
                                    renderAnnotation(isEditingThis ? editForm as Issue : issue, false, ann, idx, annIdx)
                                );
                            })}

                             {/* Drag Preview Overlay */}
                             {dragStart?.type === 'live' && currentDrag && (
                                editForm.annotationType === 'arrow' ? (
                                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-50">
                                         <defs>
                                            <marker id="temp-arrow-live" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                                                <polygon points="0 0, 6 2, 0 4" fill="#8b5cf6" />
                                            </marker>
                                        </defs>
                                        <line 
                                            x1={dragStart.x} y1={dragStart.y} 
                                            x2={currentDrag.x} y2={currentDrag.y} 
                                            stroke="#8b5cf6" 
                                            strokeWidth="3"
                                            strokeDasharray="5,5"
                                            markerEnd="url(#temp-arrow-live)"
                                        />
                                    </svg>
                                ) : (
                                    <div 
                                        className="absolute border-2 border-violet-500 bg-violet-500/30 z-50 pointer-events-none"
                                        style={{
                                            left: Math.min(dragStart.x, currentDrag.x),
                                            top: Math.min(dragStart.y, currentDrag.y),
                                            width: Math.abs(currentDrag.x - dragStart.x),
                                            height: Math.abs(currentDrag.y - dragStart.y)
                                        }}
                                    ></div>
                                )
                            )}
                         </div>
                     ) : <div className="h-full flex items-center justify-center text-slate-400">No Live Image</div>}
                </div>
            </div>

        </div>

        {/* RIGHT COLUMN: Issues Sidebar */}
        <div className="w-full xl:w-96 shrink-0 flex flex-col gap-6">
            
            {/* Specific Issues List */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[calc(100vh-100px)] sticky top-6">
                <div className="p-4 border-b border-slate-100 bg-slate-50/80 backdrop-blur-sm z-10 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 text-lg">Issues Detected</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">{issues.length}</span>
                        <button 
                            onClick={createIssue}
                            className="bg-cyan-600 hover:bg-cyan-700 text-white p-1 rounded-full font-bold flex items-center justify-center transition-colors shadow-sm"
                            title="Add Issue Manually"
                        >
                            <PlusIcon className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
                
                <div className="overflow-y-auto p-2 space-y-2 custom-scrollbar min-h-[200px]">
                    {issues.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 gap-4 text-slate-400">
                             <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100">
                                <SparklesIcon className="w-6 h-6 text-slate-300" />
                             </div>
                            <div>
                                <p className="text-sm font-bold text-slate-600">No issues recorded</p>
                                <p className="text-xs text-slate-400 mt-1">The list is currently empty.</p>
                            </div>
                            <button 
                                onClick={createIssue} 
                                className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
                            >
                                <PlusIcon className="w-3.5 h-3.5" />
                                Add Issue Manually
                            </button>
                        </div>
                    )}
                    
                    {issues.map((issue, idx) => {
                        const isEditingThis = editingIssueId === issue.id;

                        if (isEditingThis) {
                            return (
                                <div key={issue.id} className="p-3 bg-white border-2 border-violet-400 rounded-xl shadow-lg animate-in fade-in zoom-in-95 duration-200">
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center text-xs font-bold text-violet-600 uppercase">
                                            <span>Editing Issue #{idx + 1}</span>
                                        </div>
                                        
                                        {/* Annotation Type Selector */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-2">Annotation Type</label>
                                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                                <button
                                                    onClick={() => setEditForm({ ...editForm, annotationType: 'box' })}
                                                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-2 rounded-md text-xs font-bold transition-all ${(!editForm.annotationType || editForm.annotationType === 'box') ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                                >
                                                    <RectangleIcon className="w-4 h-4" />
                                                    Box
                                                </button>
                                                <button
                                                    onClick={() => setEditForm({ ...editForm, annotationType: 'arrow' })}
                                                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-2 rounded-md text-xs font-bold transition-all ${editForm.annotationType === 'arrow' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                                >
                                                    <ArrowIcon className="w-4 h-4" />
                                                    Arrow
                                                </button>
                                            </div>
                                            <p className="text-[10px] text-slate-400 mt-1 text-center">Draw multiple annotations on images. Click to remove.</p>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Title</label>
                                            <input 
                                                type="text" 
                                                value={editForm.title || ''} 
                                                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                                className="w-full text-sm p-2 border border-slate-300 rounded focus:border-violet-500 focus:outline-none bg-white text-slate-800"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Description</label>
                                            <textarea 
                                                value={editForm.description || ''} 
                                                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                                className="w-full text-sm p-2 border border-slate-300 rounded focus:border-violet-500 focus:outline-none h-20 resize-none bg-white text-slate-800"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 mb-1">Severity</label>
                                                <select 
                                                    value={editForm.severity || 'Medium'}
                                                    onChange={(e) => setEditForm({ ...editForm, severity: e.target.value as any })}
                                                    className="w-full text-xs p-2 border border-slate-300 rounded bg-white text-slate-800"
                                                >
                                                    <option value="High">High</option>
                                                    <option value="Medium">Medium</option>
                                                    <option value="Low">Low</option>
                                                </select>
                                            </div>
                                        </div>
                                        
                                        <div className="pt-2 flex gap-2">
                                            <button 
                                                onClick={saveEdit}
                                                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold py-2 rounded flex items-center justify-center gap-1"
                                            >
                                                <CheckIcon className="w-4 h-4" /> Save
                                            </button>
                                            <button 
                                                onClick={cancelEdit}
                                                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold py-2 rounded"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div 
                                key={issue.id}
                                className={`group p-3 rounded-lg cursor-pointer transition-all duration-200 border relative overflow-hidden
                                    ${hoveredIssueId === issue.id 
                                        ? 'bg-gradient-to-r from-blue-50 to-white border-blue-200 shadow-md translate-x-1' 
                                        : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-100'}
                                    ${editingIssueId ? 'opacity-50 hover:opacity-100' : ''} 
                                `}
                                onMouseEnter={() => !editingIssueId && setHoveredIssueId(issue.id)}
                                onMouseLeave={() => !editingIssueId && setHoveredIssueId(null)}
                                onClick={() => {
                                    if (!editingIssueId) {
                                        setSelectedIssueId(issue.id);
                                    }
                                }}
                            >
                                <div className="flex gap-3 relative z-10">
                                    <span className={`flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-all duration-200 ${hoveredIssueId === issue.id ? 'bg-blue-600 text-white scale-110 shadow-blue-200' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'}`}>
                                        {idx + 1}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            {issue.annotationType === 'arrow' && <ArrowIcon className="w-3 h-3 text-slate-400" />}
                                            <p className={`text-sm font-bold truncate transition-colors ${hoveredIssueId === issue.id ? 'text-blue-900' : 'text-slate-800'}`}>
                                                {issue.title}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border
                                                ${issue.severity === 'High' ? 'bg-red-50 text-red-600 border-red-100' :
                                                issue.severity === 'Medium' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                                                'bg-blue-50 text-blue-600 border-blue-100'}
                                            `}>
                                                {issue.severity}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {!editingIssueId && (
                                        <div className="self-center flex items-center gap-0.5">
                                            <button
                                                onClick={(e) => deleteIssue(issue.id, e)}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                title="Delete Issue"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    startEdit(issue);
                                                }}
                                                className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                title="Edit Issue"
                                            >
                                                <EditIcon className="w-4 h-4" />
                                            </button>
                                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ml-1 text-slate-300 transition-transform duration-200 ${hoveredIssueId === issue.id ? 'translate-x-1 text-blue-400' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Hover accent bar */}
                                {hoveredIssueId === issue.id && !editingIssueId && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* General Observations (if any) - Only show if not in edit mode to save space */}
            {!editingIssueId && result.generalIssues.length > 0 && (
                 <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden p-4">
                    <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                        <span className="text-yellow-500 text-base">⚠</span> General Observations
                    </h3>
                    <div className="space-y-2">
                         {result.generalIssues.map((issue, i) => (
                             <div key={i} className="text-xs bg-slate-50 p-2.5 rounded border border-slate-100 hover:border-slate-200 transition-colors">
                                 <div className="font-bold text-slate-700 mb-0.5">{issue.category}</div>
                                 <div className="text-slate-500 leading-relaxed">{issue.description}</div>
                             </div>
                         ))}
                    </div>
                 </div>
            )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedIssue && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setSelectedIssueId(null)}></div>
          
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between p-6 border-b border-slate-100 bg-white sticky top-0 z-10">
              <div className="pr-8">
                <div className="flex items-center gap-3 mb-2">
                    <span className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold text-white bg-slate-800`}>
                        {issues.findIndex(i => i.id === selectedIssue.id) + 1}
                    </span>
                    <h3 className="text-2xl font-bold text-slate-800">{selectedIssue.title}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wide
                        ${selectedIssue.severity === 'High' ? 'bg-red-50 text-red-700 border-red-200' : 
                          selectedIssue.severity === 'Medium' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 
                          'bg-blue-50 text-blue-700 border-blue-200'}
                    `}>
                        {selectedIssue.severity} Severity
                    </span>
                    
                    <button 
                         onClick={() => {
                             startEdit(selectedIssue);
                         }}
                         className="ml-4 flex items-center gap-1 text-xs font-bold text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-full transition-colors"
                    >
                        <EditIcon className="w-3.5 h-3.5" />
                        Edit
                    </button>
                </div>
              </div>
              <button 
                onClick={() => setSelectedIssueId(null)}
                className="rounded-full p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Close modal"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
                {/* Large Side-by-Side Images */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 mb-8">
                    <div className="space-y-2">
                        <div className="font-bold text-slate-500 text-sm uppercase tracking-wide flex justify-between">
                            <span className="text-green-600 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                Design Mockup (Expected)
                            </span>
                        </div>
                        <div className="w-full h-[300px] md:h-[400px] rounded-xl border border-slate-200 shadow-inner bg-slate-100 overflow-hidden relative group">
                             <div className="w-full h-full transition-transform duration-500 hover:scale-110 origin-center" style={getCropStyle(selectedIssue, designImageSrc, 'design', 300)}></div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="font-bold text-slate-500 text-sm uppercase tracking-wide flex justify-between">
                            <span className="text-red-600 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                Live Implementation (Observed)
                            </span>
                        </div>
                        <div className="w-full h-[300px] md:h-[400px] rounded-xl border border-slate-200 shadow-inner bg-slate-100 overflow-hidden relative group">
                             <div className="w-full h-full transition-transform duration-500 hover:scale-110 origin-center" style={getCropStyle(selectedIssue, liveImageSrc, 'live', 300)}></div>
                        </div>
                    </div>
                </div>

                {/* Issue Details Section */}
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                    <h4 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">Issue Details</h4>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-4">
                            <div>
                                <h5 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Description</h5>
                                <p className="text-slate-700 leading-relaxed">{selectedIssue.description}</p>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                    <h5 className="text-xs font-bold text-green-600 uppercase mb-2">Expected Behaviour</h5>
                                    <p className="text-sm text-slate-600">{selectedIssue.designReference}</p>
                                </div>
                                <div className="bg-white p-4 rounded-lg border border-red-100 shadow-sm">
                                    <h5 className="text-xs font-bold text-red-600 uppercase mb-2">Observed Behaviour</h5>
                                    <p className="text-sm text-slate-600">{selectedIssue.liveObservation}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-cyan-50 border border-cyan-100 rounded-lg p-5 h-fit shadow-sm">
                            <h5 className="flex items-center gap-2 text-sm font-bold text-cyan-800 uppercase tracking-wider mb-3">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Suggested Fix
                            </h5>
                            <div className="font-mono text-sm text-cyan-900 bg-white/50 p-3 rounded border border-cyan-200/50 break-words">
                                {selectedIssue.suggestion}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="bg-slate-50 p-4 border-t border-slate-200 text-center text-xs text-slate-400">
                Press ESC to close
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
