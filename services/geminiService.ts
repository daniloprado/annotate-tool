
import { GoogleGenAI } from "@google/genai";
import { fileToBase64 } from "../utils";
import { AnalysisResult, Issue } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const getMimeType = (file: File): string => {
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (validTypes.includes(file.type)) {
    return file.type;
  }
  throw new Error('Unsupported file type. Please use JPG, PNG, GIF, or WebP.');
};

export const runDesignQA = async (designFile: File, liveFile: File): Promise<AnalysisResult> => {
  try {
    const designMimeType = getMimeType(designFile);
    const liveMimeType = getMimeType(liveFile);

    const designBase64 = await fileToBase64(designFile);
    const liveBase64 = await fileToBase64(liveFile);

    const designImagePart = {
      inlineData: {
        mimeType: designMimeType,
        data: designBase64,
      },
    };

    const liveImagePart = {
      inlineData: {
        mimeType: liveMimeType,
        data: liveBase64,
      },
    };

    const prompt = `
      You are an expert Design QA Engineer with a pixel-perfect eye.
      Compare the first image (Design Mockup) with the second image (Live Implementation).

      Identify visual discrepancies including layout shifts, incorrect colors, wrong fonts, spacing errors, and missing elements.

      **CRITICAL QA RULES (Based on Known Issues):**
      1. **Typography Precision:** Scrutinize Font Weight (e.g., Bold vs Regular) and Font Size. These are high-priority mismatches.
      2. **Spacing & Gaps:** Look for unwanted extra whitespace or gaps between containers that shouldn't be there (e.g., "remove gap").
      3. **Borders & Effects:** Check for Border Stroke mismatches (color/width) and Drop Shadows (missing or unwanted shadows).
      4. **Charts & Graphs:** If charts are present, compare the line curvature, axis labels, and legend placement strictly.
      5. **Alignment:** Check for vertical alignment issues where text or icons are off by a few pixels.

      Output PURE JSON matching this structure (no markdown, no backticks):
      {
        "score": number, // 0-100, where 100 is pixel perfect
        "generalIssues": [ // Issues that affect the whole page (e.g. wrong font family globally)
          { "category": "Typography" | "Layout" | "Color" | "Content" | "Effects", "description": "string" }
        ],
        "specificIssues": [
          {
            "id": "1",
            "title": "Short title of issue",
            "description": "Detailed description of the difference.",
            "box_2d": [ymin, xmin, ymax, xmax], // Bounding box of the issue on the LIVE image. Scale 0-1000.
            "design_box_2d": [ymin, xmin, ymax, xmax], // Bounding box of the issue on the DESIGN image. Scale 0-1000.
            "designReference": "What it looks like in design (e.g. 'Blue button', 'No gap')",
            "liveObservation": "What it looks like in live (e.g. 'Green button', 'Large gap present')",
            "suggestion": "CSS fix suggestion (e.g. 'font-weight: 600', 'remove margin-bottom')",
            "severity": "High" | "Medium" | "Low"
          }
        ]
      }
      
      Ensure box_2d coordinates are accurate for the LIVE image and design_box_2d are accurate for the DESIGN image.
      If the designs match perfectly, return empty arrays.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image', 
        contents: { parts: [
            designImagePart,
            liveImagePart,
            { text: prompt },
        ]},
        config: {
            systemInstruction: "You are a precise Design QA automated bot. Return only JSON.",
        }
    });

    const text = response.text || "{}";
    // Clean up if the model includes markdown code blocks
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const rawResult = JSON.parse(cleanJson);

    // Transform raw result to include new annotation arrays
    const transformedIssues = rawResult.specificIssues.map((issue: any) => ({
      ...issue,
      liveAnnotations: issue.box_2d && issue.box_2d.length === 4 
        ? [{ type: 'box', coords: issue.box_2d }] 
        : [],
      designAnnotations: issue.design_box_2d && issue.design_box_2d.length === 4 
        ? [{ type: 'box', coords: issue.design_box_2d }] 
        : [],
      annotationType: 'box' // Default for UI state
    }));

    return {
      ...rawResult,
      specificIssues: transformedIssues
    } as AnalysisResult;

  } catch (error) {
    console.error("Error in Gemini API call:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to analyze images: ${error.message}`);
    }
    throw new Error("An unknown error occurred during image analysis.");
  }
};
