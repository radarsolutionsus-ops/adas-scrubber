declare module "pdf-parse/lib/pdf-parse" {
  export default function pdfParse(dataBuffer: Buffer): Promise<{ text: string }>;
}
