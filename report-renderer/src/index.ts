import puppeteer from "@cloudflare/puppeteer";

type Env = {
  BROWSER: Fetcher;
};

type PdfRequest = {
  title?: string;
  html?: string;
  pdfOptions?: {
    format?: "A4" | "A3" | "Letter";
    printBackground?: boolean;
    margin?: {
      top?: string;
      right?: string;
      bottom?: string;
      left?: string;
    };
  };
};

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, worker: "dedications-report-renderer" });
    }

    if (url.pathname !== "/render/pdf" || request.method !== "POST") {
      return new Response("Not Found", { status: 404 });
    }

    let payload: PdfRequest;
    try {
      payload = await request.json<PdfRequest>();
    } catch {
      return jsonError("Invalid JSON", 400);
    }

    if (!payload.html) return jsonError("html is required", 400);

    const browser = await puppeteer.launch(env.BROWSER);
    const page = await browser.newPage();

    try {
      await page.setContent(payload.html, { waitUntil: "load" });
      await page.evaluate(() => document.fonts?.ready);
      const pdf = await page.pdf({
        format: payload.pdfOptions?.format ?? "A4",
        printBackground: payload.pdfOptions?.printBackground ?? true,
        margin: payload.pdfOptions?.margin ?? {
          top: "12mm",
          right: "10mm",
          bottom: "12mm",
          left: "10mm",
        },
      });
      const pdfBody = new Uint8Array(pdf.buffer, pdf.byteOffset, pdf.byteLength).slice().buffer;

      return new Response(pdfBody, {
        headers: {
          "Content-Type": "application/pdf",
          "Cache-Control": "no-store",
          "X-Report-Renderer": "browser-run",
        },
      });
    } finally {
      await page.close();
      await browser.close();
    }
  },
} satisfies ExportedHandler<Env>;
