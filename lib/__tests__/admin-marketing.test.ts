import { afterEach, describe, expect, it, vi } from 'vitest'

const mockReaddir = vi.fn()
const mockReadFile = vi.fn()

vi.mock('node:fs/promises', () => ({
  readdir: (...args: unknown[]) => mockReaddir(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
}))

const { listMarketingDrafts } = await import('@/lib/admin-marketing')

// docs/marketing/drafts/<date>-slug.md reader for the admin Team view's
// "Drafts awaiting review" section. NEVER throws: a missing directory or an
// unreadable file both degrade rather than crash the page.

afterEach(() => {
  vi.restoreAllMocks()
  mockReaddir.mockClear()
  mockReadFile.mockClear()
})

describe('listMarketingDrafts()', () => {
  it('returns [] when the drafts directory does not exist', async () => {
    mockReaddir.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))

    await expect(listMarketingDrafts()).resolves.toEqual([])
    expect(mockReadFile).not.toHaveBeenCalled()
  })

  it('parses frontmatter and derives date/slug from the filename', async () => {
    mockReaddir.mockResolvedValue(['2026-07-06-reddit-sweet-spot.md', 'funnel-log.md.bak'])
    mockReadFile.mockResolvedValue(
      '---\ntitle: "Sweet spot: SFO-NRT on ANA miles"\nchannel: reddit\nstatus: awaiting-approval\n---\n\nBody content here.\n'
    )

    const drafts = await listMarketingDrafts()

    expect(mockReadFile).toHaveBeenCalledTimes(1)
    expect(drafts).toEqual([
      {
        slug: 'reddit-sweet-spot',
        filename: '2026-07-06-reddit-sweet-spot.md',
        date: '2026-07-06',
        title: 'Sweet spot: SFO-NRT on ANA miles',
        channel: 'reddit',
        status: 'awaiting-approval',
        githubUrl:
          'https://github.com/n3wth/hop/blob/main/docs/marketing/drafts/2026-07-06-reddit-sweet-spot.md',
      },
    ])
  })

  it('falls back to defaults when frontmatter fields are missing', async () => {
    mockReaddir.mockResolvedValue(['2026-07-06-hn-launch-post.md'])
    mockReadFile.mockResolvedValue('no frontmatter at all, just body text')

    const [draft] = await listMarketingDrafts()

    expect(draft.title).toBe('hn launch post')
    expect(draft.channel).toBe('unknown')
    expect(draft.status).toBe('awaiting-approval')
  })

  it('sorts newest-first by filename', async () => {
    mockReaddir.mockResolvedValue(['2026-07-01-old-post.md', '2026-07-06-new-post.md'])
    mockReadFile.mockResolvedValue('---\nchannel: x\nstatus: ready-to-paste\n---\n')

    const drafts = await listMarketingDrafts()

    expect(drafts.map((d) => d.filename)).toEqual([
      '2026-07-06-new-post.md',
      '2026-07-01-old-post.md',
    ])
  })

  it('skips a file that fails to read instead of throwing for the whole list', async () => {
    mockReaddir.mockResolvedValue(['2026-07-05-good.md', '2026-07-06-broken.md'])
    mockReadFile.mockImplementation(async (path: unknown) => {
      if (String(path).includes('broken')) throw new Error('EACCES')
      return '---\nchannel: reddit\nstatus: sent\n---\n'
    })

    const drafts = await listMarketingDrafts()

    expect(drafts).toHaveLength(1)
    expect(drafts[0].filename).toBe('2026-07-05-good.md')
  })

  it('ignores non-markdown files in the directory', async () => {
    mockReaddir.mockResolvedValue(['README.txt', '.DS_Store'])

    await expect(listMarketingDrafts()).resolves.toEqual([])
    expect(mockReadFile).not.toHaveBeenCalled()
  })
})
