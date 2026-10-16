/** 从宿主注册表发现模式，不根据界面名称猜测模式类型。 */
export async function discoverPresets(registry, known) {
  const found = new Map(known.map(id => [id, { id, name: id }]))
  if (typeof registry?.list === 'function') {
    for (const row of await registry.list()) {
      if (typeof row?.id !== 'string' || !row.id.trim()) continue
      found.set(row.id, { id: row.id, name: typeof row.name === 'string' ? row.name : row.id,
        ...(row.broken ? { broken: String(row.broken) } : {}) })
    }
  }
  return found
}

/** 第三方模式仅增加独立分块，原角色、工具协议与审批正文逐字保留。 */
export function fuseThirdParty(sections, block) {
  if (!Array.isArray(sections) || sections.some(row => typeof row?.text !== 'string')) {
    return { issues: ['third-party prompt sections unavailable'] }
  }
  if (sections.length <= 1) {
    return { issues: ['single-section or complete third-party prompt requires explicit adaptation'] }
  }
  if (sections.some(row => row.name === block.name)) return { sections }
  const result = [...sections]
  const index = result.findIndex(row => row.name === 'deployment:persona-prefix')
  result.splice(index < 0 ? 0 : index + 1, 0, { ...block })
  return { sections: result }
}
