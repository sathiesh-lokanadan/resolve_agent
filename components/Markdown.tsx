import ReactMarkdown from "react-markdown";

export default function Markdown({ text }: { text: string }) {
  return (
    <div className="md text-[15px] leading-relaxed">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}
