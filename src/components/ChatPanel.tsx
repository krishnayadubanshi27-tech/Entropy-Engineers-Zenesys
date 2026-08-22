import { useEffect, useRef, useState } from "react";
import { Bot, SendHorizonal, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { aiService } from "@/services/ai";
import { contractStore, useChatMessages } from "@/services/store";
import type { Contract } from "@/services/types";
import { cn } from "@/lib/utils";
import { Button } from "./ui";

function openingMessage(contract: Contract): string {
  const a = contract.analysis;
  if (!a) return "";
  const risks = a.clauses.filter((c) => c.impact === "negative").slice(0, 3);
  const lines: string[] = [
    `I've finished reading **${contract.title}**. Overall risk score: **${a.riskScore}/100**.`,
  ];
  if (risks.length > 0) {
    lines.push("", "**Top risk warnings:**");
    for (const r of risks) lines.push(`- **${r.title}** — ${r.note}`);
  }
  if (a.recommendations.length > 0) {
    lines.push("", "**Recommended next steps:**");
    a.recommendations.slice(0, 4).forEach((rec, i) => lines.push(`${i + 1}. ${rec}`));
  }
  lines.push("", "Ask me anything about this contract — clauses, deadlines, or what to negotiate.");
  return lines.join("\n");
}

export function ChatPanel({ contract }: { contract: Contract }) {
  const allMessages = useChatMessages();
  const messages = allMessages.filter((m) => m.contractId === contract.id);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const openedRef = useRef(false);

  // Proactive opening message once analysis is available.
  useEffect(() => {
    if (openedRef.current) return;
    if (contract.status !== "analyzed" || !contract.analysis) return;
    if (contractStore.getMessages().some((m) => m.contractId === contract.id)) {
      openedRef.current = true;
      return;
    }
    openedRef.current = true;
    contractStore.addMessage(contract.id, "assistant", openingMessage(contract));
  }, [contract]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, sending]);

  const send = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    if (!contract.text) {
      toast.error("The contract text is not available yet — run the analysis first.");
      return;
    }
    setDraft("");
    setSending(true);
    contractStore.addMessage(contract.id, "user", content);
    try {
      const history = contractStore
        .getMessages()
        .filter((m) => m.contractId === contract.id)
        .slice(-20);
      const reply = await aiService.chat(contract.title, contract.text, history);
      contractStore.addMessage(contract.id, "assistant", reply);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The AI assistant failed to reply.";
      toast.error(message);
      contractStore.addMessage(
        contract.id,
        "assistant",
        `⚠️ I couldn't answer just now: ${message}\n\nPlease try again.`,
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="glass flex h-full min-h-[420px] flex-col rounded-2xl">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="grid size-7 place-items-center rounded-lg bg-primary/15 text-primary">
          <Bot className="size-4" />
        </span>
        <div>
          <p className="font-display text-sm font-semibold text-foreground">AI Assistant</p>
          <p className="text-[11px] text-muted-foreground">Has read this contract</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            The assistant will brief you once the analysis completes.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex gap-2", m.role === "user" && "flex-row-reverse")}>
            <span
              className={cn(
                "mt-0.5 grid size-6 shrink-0 place-items-center rounded-md",
                m.role === "assistant" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground",
              )}
            >
              {m.role === "assistant" ? <Bot className="size-3.5" /> : <User className="size-3.5" />}
            </span>
            <div
              className={cn(
                "max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed",
                m.role === "assistant"
                  ? "bg-secondary/60 text-foreground"
                  : "bg-primary/15 text-foreground",
              )}
            >
              {m.role === "assistant" ? (
                <div className="prose-sm [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:my-1 [&_li]:my-0.5">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex gap-2">
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
              <Bot className="size-3.5" />
            </span>
            <div className="rounded-xl bg-secondary/60 px-3 py-2 text-sm text-muted-foreground">
              Thinking…
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Ask about this contract…"
            aria-label="Message the AI assistant"
            className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button onClick={() => void send()} disabled={!draft.trim() || sending} className="px-3" aria-label="Send message">
            <SendHorizonal className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
