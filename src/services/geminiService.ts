import { Employee } from "../types";

const fetchGeminiApi = async (action: string, payload: any) => {
  const response = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to fetch from Gemini API");
  }

  return response.json();
};

export const extractEmployeeDataFromText = async (
  textData: string,
): Promise<Partial<Employee>> => {
  try {
    const data = await fetchGeminiApi("extract-text", { textData });
    const text = data.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text);
  } catch (error) {
    console.error("Error parsing AI response:", error);
    throw new Error("Gagal mengekstrak data dari teks.");
  }
};

export const extractEmployeeData = async (
  fileData: string,
  mimeType: string,
): Promise<Partial<Employee>> => {
  try {
    const data = await fetchGeminiApi("extract-file", { fileData, mimeType });
    const text = data.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text);
  } catch (error) {
    console.error("Error parsing AI response:", error);
    throw new Error("Gagal mengekstrak data dari file.");
  }
};

export const mapExcelColumnsWithAI = async (
  headers: string[],
): Promise<Record<string, string>> => {
  try {
    const data = await fetchGeminiApi("map-headers", { headers });
    const text = data.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text);
  } catch (error) {
    console.error("Error parsing AI mapping response:", error);
    return {};
  }
};
