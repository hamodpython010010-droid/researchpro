import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.OPENAI_MODEL || "gpt-5.5";

if (!process.env.OPENAI_API_KEY) {
  console.error("ضع OPENAI_API_KEY داخل ملف .env ثم شغّل المشروع مرة أخرى.");
  process.exit(1);
}
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => res.json({ ok: true, model: MODEL }));

function cleanHtml(html = "") {
  return String(html)
    .replace(/```html/gi, "").replace(/```/g, "")
    .replace(/<\s*(script|style|iframe|object|embed|form|input|button)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/javascript:/gi, "").trim();
}

app.post("/api/generate-research", async (req, res) => {
  try {
    const b = req.body || {};
    const topic = String(b.prompt || "").trim();
    if (!topic) return res.status(400).json({ ok: false, error: "اكتب موضوع البحث أولًا." });

    const profile = `
موضوع البحث: ${topic}
الطالب: ${b.student || "غير محدد"}
المؤسسة: ${b.university || "غير محددة"}
الكلية: ${b.college || "غير محددة"}
القسم: ${b.department || "غير محدد"}
المادة: ${b.subject || "غير محددة"}
المشرف: ${b.supervisor || "غير محدد"}
المستوى: ${b.academicLevel || "غير محدد"}
الطول: ${b.length || "متوسط"}
اللغة: ${b.language || "العربية"}
متطلبات إضافية: ${b.requirements || "لا توجد"}
`;

    const instructions = `أنت محرك أبحاث أكاديمية اسمه ResearchPro. ابحث فعليًا على الإنترنت قبل الكتابة، ولا تكتفِ بالمعرفة الداخلية. استخدم مصادر أولية ورسمية وأبحاثًا علمية كلما أمكن، وقارن المعلومات. لا تخترع أرقامًا أو مراجع أو روابط.

يجب أن يكون الناتج HTML فقط، بدون Markdown أو backticks. استخدم فقط h1,h2,h3,p,ul,ol,li,table,thead,tbody,tr,th,td,strong,em,blockquote,a.

اكتب بحثًا حقيقيًا ومنظمًا حسب الموضوع والمستوى والطول. اجعل الأقسام مناسبة للموضوع، مثل: المقدمة، مشكلة البحث، الأسئلة، الأهداف، الأهمية، المنهجية، المفاهيم، الإطار النظري، المحاور الرئيسية، التحليل والمناقشة، أمثلة/تطبيقات، التحديات، النتائج، التوصيات، الخاتمة، والمراجع. لا تضف قسمًا لا يخدم الموضوع.

في المراجع: اذكر فقط المصادر التي استخدمتها فعليًا، وضع اسم المصدر والرابط الكامل داخل a target="_blank" rel="noopener noreferrer". استخدم روابط حقيقية ظهرت أثناء البحث. لا تكتب كلامًا خارج البحث.`;

    const response = await client.responses.create({
      model: MODEL,
      reasoning: { effort: "medium" },
      tools: [{ type: "web_search", search_context_size: "high" }],
      tool_choice: "required",
      instructions,
      input: profile
    });

    const research = cleanHtml(response.output_text || "");
    if (!research) return res.status(502).json({ ok: false, error: "محرك البحث لم يرجع محتوى." });

    res.json({ ok: true, research, model: MODEL });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e?.message || "حدث خطأ أثناء إنشاء البحث." });
  }
});

app.use((_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, () => console.log(`ResearchPro: http://localhost:${PORT}`));
