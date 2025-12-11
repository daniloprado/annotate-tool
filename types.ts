
export interface Annotation {
  type: 'box' | 'arrow';
  coords: [number, number, number, number]; // [ymin, xmin, ymax, xmax] or [y1, x1, y2, x2]
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  // Deprecating single fields in favor of arrays, but keeping optional for backward compat logic if needed temporarily
  box_2d?: [number, number, number, number]; 
  design_box_2d?: [number, number, number, number];
  
  // New Array Structure
  liveAnnotations: Annotation[];
  designAnnotations: Annotation[];

  designReference: string;
  liveObservation: string;
  suggestion: string;
  severity: 'High' | 'Medium' | 'Low';
  // Default annotation type for the "next" drawing action
  annotationType?: 'box' | 'arrow'; 
}

export interface GeneralIssue {
  category: string;
  description: string;
}

export interface AnalysisResult {
  score: number;
  generalIssues: GeneralIssue[];
  specificIssues: Issue[];
}
