import test from 'node:test'
import assert from 'node:assert/strict'
import { discoverPresets, checkDiscoveredPresets, fuseThirdParty } from '../src/discovery.js'

test('刷新与重新检查必须等待所有第三方模式检查结束', async () => {
  const discovered = await discoverPresets({ list: async () => [{ id: 'writer' }, { id: 'researcher' }] }, ['standard'])
  const finished = new Set()
  await checkDiscoveredPresets(discovered, async id => {
    await new Promise(resolve => setImmediate(resolve))
    finished.add(id)
  })
  assert.deepEqual([...finished].sort(), ['researcher', 'standard', 'writer'])
})

test('扫描注册表包含第三方模式并跟随安装和移除', async () => {
  let rows = [{ id: 'researcher', name: '研究员' }, { id: 'broken', broken: 'missing tool' }]
  const registry = { list: async () => rows }
  const first = await discoverPresets(registry, ['standard'])
  assert.equal(first.get('researcher').name, '研究员')
  assert.equal(first.get('broken').broken, 'missing tool')
  rows = [{ id: 'writer' }]
  const second = await discoverPresets(registry, ['standard'])
  assert.equal(second.has('researcher'), false)
  assert.equal(second.has('writer'), true)
})

test('没有注册表的宿主仍保留内置模式', async () => {
  assert.deepEqual([...await discoverPresets(undefined, ['standard'])].map(([id]) => id), ['standard'])
})

test('扫描失败向调用者报告，不假装没有第三方模式', async () => {
  await assert.rejects(discoverPresets({ list: async () => { throw Error('offline') } }, []), /offline/)
})

test('保留自定义角色、计划限制、PTC协议及结构化输出，且不重复注入', () => {
  const sections = [
    { name: 'deployment:persona-prefix', text: '我是研究员', interpolate: false },
    { name: 'plan:policy', text: 'Approval is required before writing.' },
    { name: 'tools:ptc-only', text: 'Custom protocol' },
    { name: 'tool:structured_output', text: 'Custom output schema' },
  ]
  const before = structuredClone(sections)
  const block = { name: 'unrestricted:execution-mode', text: 'fixture block' }
  const result = fuseThirdParty(sections, block)
  assert.deepEqual(sections, before)
  assert.deepEqual(result.sections.filter(row => row.name !== block.name), before)
  assert.equal(result.sections[1].name, block.name)
  assert.deepEqual(fuseThirdParty(result.sections, block), result)
})

test('完整提示词和无效输入明确报告不支持', () => {
  const block = { name: 'test', text: 'fixture' }
  assert.match(fuseThirdParty([{ name: 'complete', text: 'Custom persona' }], block).issues[0], /explicit adaptation/)
  assert.ok(fuseThirdParty([{ name: 'bad' }], block).issues)
})

test('第三方提示词无需使用官方角色分块名称', () => {
  const source = [{ name: 'custom:persona', text: 'Research' }, { name: 'custom:tools', text: 'Read only' }]
  const block = { name: 'test', text: 'fixture' }
  assert.deepEqual(fuseThirdParty(source, block).sections, [block, ...source])
})
