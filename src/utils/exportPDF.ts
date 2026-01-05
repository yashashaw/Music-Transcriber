import { fetchPDFExport } from "../api/api";

export const exportToPDF = async () => {
  try {
    // This looks exactly the same!
    const blobData = await fetchPDFExport();

    const url = window.URL.createObjectURL(new Blob([blobData]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'drum-transcription.pdf');
    
    document.body.appendChild(link);
    link.click();
    
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);

  } catch (error) {
    console.error('Export failed:', error);
    alert('Failed to download PDF.');
  }
};