import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, Base64ImageSource } from "@anthropic-ai/sdk/resources/messages";

const SYSTEM_PROMPT = `Jsi Lumina Vision, přátelská a profesionální AI asistentka specializovaná na tvorbu promptů pro generování vizuálů. Komunikuješ česky, tykáš klientce.

PŘI ZAHÁJENÍ CHATU se automaticky představ (bez slova "Vítej"), řekni co umíš a s čím pomůžeš - konkrétně popiš že pomáháš vytvořit přesný popis toho jak bude obrázek vypadat nebo jak vytvořit video. Pak postupně zjisti:
1. Jak se klientka jmenuje a co dělá
2. Kdo je její spřízněný (cílový) klient
3. Zda chce tvořit OBRÁZEK nebo VIDEO (toto určuje celý další průběh - v jednom chatu děláš pouze jeden typ, ale upozorni klientku že pro druhý typ si může otevřít nový chat)

PRO OBRÁZKY se zeptej na:
- V jakém nástroji chce obrázek vytvořit - nabídni možnosti: ChatGPT, Gemini, Google AI Studio, Canva, Sora, Adobe Firefly - nebo ať napíše jiný nástroj který používá
- Co má být na obrázku - zde veď HLUBOKOU konverzaci, ptej se na detaily dokud Lumina přesně neví co má na obrázku být: prostředí, objekty, osoby, děj, nálada, světlo, perspektiva, styl
- Brandové barvy nebo konkrétní barvy které chce na obrázku
- Zda jsou na obrázku lidé a jací (věk, výraz, oblečení, pozice)
- Formát obrázku (čtverec, na výšku, na šířku)
- Klientka může nahrát referenční obrázek jako inspiraci nebo pro úpravu - Lumina obrázek popíše a zeptá se co chce zachovat nebo změnit

PRO VIDEA se zeptej na:
- V jakém nástroji chce video vytvořit - nabídni možnosti: Google AI Studio, Gemini, Canva, Kling - nebo ať napíše jiný nástroj který používá
- Co má být ve videu - zde veď HLUBOKOU konverzaci, ptej se na detaily dokud Lumina přesně neví co má ve videu být: scéna, pohyb, objekty, osoby, děj, nálada, světlo
- Brandové barvy nebo konkrétní barvy které chce ve videu
- Upozorni že videa jsou většinou jen 8 sekund - ať tomu přizpůsobí obsah
- Zda chce titulky - upozorni že nástroje neumí dobře českou diakritiku, lepší je použít externí nástroj na titulky
- Pohyb kamery (statická, zoom, panorama), styl, nálada

TVORBA PROMPTU:
- Prompt NIKDY nevytváříš dokud nemáš absolutně všechny potřebné informace a dokud si nejsi jako Lumina 100% jistá co má vizuál obsahovat - jedině pokud si klientka sama výslovně řekne že chce prompt už teď
- Prompt napíšeš ANGLICKY (lepší výsledky) A ZÁROVEŇ ČESKY pod ním (aby klientka rozuměla co je tam napsáno)
- Po napsání promptu se zeptáš zda je prompt v pořádku nebo co chce upravit
- Konverzace pokračuje dokud klientka neřekne že je spokojená`;

const ALLOWED_MEDIA_TYPES: Base64ImageSource["media_type"][] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

type RawContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

function normalizeMessages(raw: { role: string; content: string | RawContentBlock[] }[]): MessageParam[] {
  return raw.map((m) => {
    const role = m.role as "user" | "assistant";
    if (typeof m.content === "string") {
      return { role, content: m.content };
    }
    const content = m.content.map((block) => {
      if (block.type === "text") return block;
      const mediaType = ALLOWED_MEDIA_TYPES.includes(block.source.media_type as Base64ImageSource["media_type"])
        ? (block.source.media_type as Base64ImageSource["media_type"])
        : "image/jpeg";
      return {
        type: "image" as const,
        source: { type: "base64" as const, media_type: mediaType, data: block.source.data },
      };
    });
    return { role, content };
  });
}

export async function POST(request: Request) {
  let messages: unknown, apiKey: unknown;
  try {
    ({ messages, apiKey } = await request.json());
  } catch {
    return Response.json(
      { error: "Požadavek je příliš velký nebo obsahuje neplatná data. Zkus nahrát menší obrázek." },
      { status: 413 }
    );
  }

  try {
    if (!apiKey) {
      return Response.json({ error: "API klíč chybí" }, { status: 400 });
    }

    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: "Zprávy chybí" }, { status: 400 });
    }

    // Guard against oversized base64 image data (~3 MB limit after encoding)
    const MAX_BASE64 = 3 * 1024 * 1024;
    for (const msg of messages as { role: string; content: unknown }[]) {
      if (Array.isArray(msg.content)) {
        for (const block of msg.content as RawContentBlock[]) {
          if (block.type === "image" && block.source.data.length > MAX_BASE64) {
            return Response.json(
              { error: "Obrázek je příliš velký. Nahraj prosím menší nebo jinak komprimovaný soubor." },
              { status: 413 }
            );
          }
        }
      }
    }

    const client = new Anthropic({ apiKey: apiKey as string });

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: normalizeMessages(messages as { role: string; content: string | RawContentBlock[] }[]),
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return Response.json({ error: "Prázdná odpověď" }, { status: 500 });
    }

    return Response.json({ text: textContent.text });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err.status === 401) {
      return Response.json(
        { error: "Neplatný API klíč. Zkontroluj jej a zkus znovu." },
        { status: 401 }
      );
    }
    return Response.json(
      { error: err.message ?? "Nastala chyba při komunikaci s API" },
      { status: 500 }
    );
  }
}
