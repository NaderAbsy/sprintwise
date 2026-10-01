import { TEMPLATE_CSV } from "@/lib/csv/template";

export function GET() {
  return new Response(`${TEMPLATE_CSV}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="sprintwise-template.csv"',
    },
  });
}
