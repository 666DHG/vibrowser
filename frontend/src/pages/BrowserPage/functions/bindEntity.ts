import type { PageBlock } from "../../../shared/pageSpec";
import type { PageEntity } from "../../../shared/pageEntity";

// Bound facts are displayed from the canonical entity, never duplicated model text.
export function bindEntity(
  block: PageBlock,
  entities: PageEntity[],
  subjectEntityId?: string | null,
): PageBlock {
  const entity = entities.find((e) => e.id === block.entityId);
  if (!entity) return block;
  const facts = [
    entity.author,
    entity.publishedAt,
    entity.replyCount == null ? null : `${entity.replyCount} 条回复`,
    entity.price ? `${entity.price.currency} ${entity.price.amount}` : null,
    !entity.author &&
    !entity.publishedAt &&
    entity.replyCount == null &&
    !entity.price
      ? entity.legacyMeta
      : null,
    block.replyRange
      ? `显示第 ${block.replyRange.from}–${block.replyRange.to} 条`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    ...block,
    title: block.replyRange ? block.title : entity.title,
    text:
      block.target && block.entityId !== subjectEntityId
        ? (entity.summary ?? block.text)
        : block.text,
    meta: facts || null,
  };
}
