import Eyebrow from './ui/Eyebrow'

export interface SectionHeadProps {
  title: string
  note?: string
  eyebrow?: string
}

// Plain section header — ink underline, no fake document numbering.
export default function SectionHead({ title, note, eyebrow }: SectionHeadProps) {
  return (
    <div className="mb-[22px] mt-14 border-b-[1.5px] border-text pb-4">
      {eyebrow ? <Eyebrow className="block mb-2">{eyebrow}</Eyebrow> : null}
      <div className="flex items-end justify-between">
        <h2 className="font-display text-[24px] font-semibold tracking-[-0.01em] text-text">
          {title}
        </h2>
        {note ? <div className="text-[13px] text-text2">{note}</div> : null}
      </div>
    </div>
  )
}
