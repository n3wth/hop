export interface SectionHeadProps {
  title: string
  note?: string
}

// Plain section header — ink underline, no fake document numbering.
export default function SectionHead({ title, note }: SectionHeadProps) {
  return (
    <div className="mb-[22px] mt-14 flex items-end justify-between border-b-[1.5px] border-text pb-4">
      <h2 className="font-display text-[24px] font-semibold tracking-[-0.01em] text-text">
        {title}
      </h2>
      {note ? <div className="text-[13px] text-text2">{note}</div> : null}
    </div>
  )
}
