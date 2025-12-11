
import React, { useState, useCallback } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { ReportDisplay } from './components/ReportDisplay';
import { EditIcon } from './components/icons/EditIcon';
import { AnalysisResult } from './types';

const App: React.FC = () => {
  const [designFile, setDesignFile] = useState<File | null>(null);
  const [liveFile, setLiveFile] = useState<File | null>(null);
  const [designPreview, setDesignPreview] = useState<string | null>(null);
  const [livePreview, setLivePreview] = useState<string | null>(null);
  
  const [report, setReport] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = useCallback((file: File, type: 'design' | 'live') => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === 'design') {
        setDesignFile(file);
        setDesignPreview(reader.result as string);
      } else {
        setLiveFile(file);
        setLivePreview(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const handleImageClear = useCallback((type: 'design' | 'live') => {
    if (type === 'design') {
      setDesignFile(null);
      setDesignPreview(null);
    } else {
      setLiveFile(null);
      setLivePreview(null);
    }
  }, []);

  const handleStartAnnotation = () => {
    if (!designFile || !liveFile) {
      setError('Please upload both a Design and a Live image to start.');
      return;
    }
    setError(null);
    // Initialize an empty report for manual annotation
    setReport({
      score: 100, // Default perfect score
      generalIssues: [],
      specificIssues: []
    });
  };

  const isButtonDisabled = !designFile || !liveFile;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 sm:p-6 lg:p-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-slate-50 to-slate-100">
      <div className={`mx-auto transition-all duration-500 ease-in-out ${report ? 'max-w-[95%]' : 'max-w-7xl'}`}>
        <header className="text-center mb-10 mt-4">
          <div className="inline-flex items-center gap-3 mb-2 animate-fade-in">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-600 via-blue-600 to-violet-600 text-transparent bg-clip-text drop-shadow-sm">
              Design QA Tool
            </h1>
          </div>
          {!report && (
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed animate-fade-in">
              Upload your design mockup and live screenshot to manually identify discrepancies and generate a report.
            </p>
          )}
        </header>

        <main>
          <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10 transition-all duration-500 ${report ? 'hidden' : 'block'}`}>
            <ImageUploader
              title="Design Mockup"
              onImageUpload={(file) => handleImageUpload(file, 'design')}
              onImageClear={() => handleImageClear('design')}
              previewUrl={designPreview}
              accentColor="border-violet-500"
            />
            <ImageUploader
              title="Live Screenshot"
              onImageUpload={(file) => handleImageUpload(file, 'live')}
              onImageClear={() => handleImageClear('live')}
              previewUrl={livePreview}
              accentColor="border-cyan-500"
            />
          </div>

          {!report && (
             <div className="text-center mb-12 flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={handleStartAnnotation}
                  disabled={isButtonDisabled}
                  className={`
                    group px-8 py-4 text-lg font-bold rounded-xl transition-all duration-300 ease-in-out
                    flex items-center justify-center min-w-[240px] overflow-hidden shadow-lg hover:shadow-xl
                    ${
                      isButtonDisabled
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                        : 'bg-gradient-to-r from-cyan-600 to-violet-600 text-white shadow-cyan-500/20 hover:scale-[1.02] active:scale-[0.98]'
                    }
                  `}
                >
                   <span className="flex items-center gap-2">
                      <EditIcon className="w-5 h-5" />
                      Start Annotating
                   </span>
                </button>
            </div>
          )}
          
          {error && (
             <div className="max-w-3xl mx-auto mb-8 bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl text-center shadow-md" role="alert">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <strong className="font-bold">Error</strong>
                </div>
                <span className="block">{error}</span>
            </div>
          )}
          
          {report && (
            <div className="animate-fade-in">
                 <div className="mb-6 flex justify-end">
                    <button 
                        onClick={() => setReport(null)}
                        className="text-sm text-slate-500 hover:text-slate-800 underline flex items-center gap-1"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
                        </svg>
                        Start New Session
                    </button>
                 </div>
                <ReportDisplay 
                  result={report} 
                  designImageSrc={designPreview}
                  liveImageSrc={livePreview}
                />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
