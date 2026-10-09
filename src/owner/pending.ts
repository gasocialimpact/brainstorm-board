// A PDF chosen on the landing page, handed to the board once it opens.
const pending = new Map<string, File>();

export const setPendingPdf = (boardId: string, file: File) => pending.set(boardId, file);

export function takePendingPdf(boardId: string) {
  const f = pending.get(boardId);
  pending.delete(boardId);
  return f;
}
