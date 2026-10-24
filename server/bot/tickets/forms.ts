import {
  ModalBuilder,
  LabelBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  RadioGroupBuilder,
  CheckboxGroupBuilder,
  CheckboxBuilder,
  type ModalSubmitInteraction,
} from 'discord.js'
import type { TicketTopic } from '../../../shared/tickets.js'
export function openingForm(customId: string, topic: TicketTopic) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(topic.name.slice(0, 45))
  for (const q of topic.questions) {
    const label = new LabelBuilder().setLabel(q.label)
    if (q.description) label.setDescription(q.description)
    const options = (q.options ?? []).map((value) => ({ label: value, value }))
    if (q.style === 'select' || q.style === 'multi') {
      const input = new StringSelectMenuBuilder()
        .setCustomId(q.id)
        .addOptions(options)
        .setRequired(q.required)
        .setMinValues(q.required ? (q.style === 'multi' ? q.minChoices : 1) : 0)
        .setMaxValues(q.style === 'multi' ? q.maxChoices : 1)
      if (q.placeholder) input.setPlaceholder(q.placeholder)
      label.setStringSelectMenuComponent(input)
    } else if (q.style === 'radio') {
      label.setRadioGroupComponent(
        new RadioGroupBuilder().setCustomId(q.id).setOptions(options).setRequired(q.required),
      )
    } else if (q.style === 'checkboxes' || (q.style === 'checkbox' && q.required)) {
      label.setCheckboxGroupComponent(
        new CheckboxGroupBuilder()
          .setCustomId(q.id)
          .setOptions(q.style === 'checkbox' ? [{ label: q.label, value: 'confirm' }] : options)
          .setRequired(q.required)
          .setMinValues(q.required ? (q.style === 'checkbox' ? 1 : q.minChoices) : 0)
          .setMaxValues(q.style === 'checkbox' ? 1 : q.maxChoices),
      )
    } else if (q.style === 'checkbox') {
      label.setCheckboxComponent(new CheckboxBuilder().setCustomId(q.id).setDefault(false))
    } else {
      const input = new TextInputBuilder()
        .setCustomId(q.id)
        .setStyle(q.style === 'short' ? TextInputStyle.Short : TextInputStyle.Paragraph)
        .setRequired(q.required)
        .setMinLength(q.minLength ?? 0)
        .setMaxLength(q.maxLength)
      if (q.placeholder) input.setPlaceholder(q.placeholder)
      label.setTextInputComponent(input)
    }
    modal.addLabelComponents(label)
  }
  return modal
}
export function formAnswers(topic: TicketTopic, fields: ModalSubmitInteraction['fields']) {
  return Object.fromEntries(
    topic.questions.map((q) => {
      let value: string
      if (q.style === 'select') value = fields.getStringSelectValues(q.id)[0] ?? ''
      else if (q.style === 'multi') value = JSON.stringify(fields.getStringSelectValues(q.id))
      else if (q.style === 'radio') value = fields.getRadioGroup(q.id, false) ?? ''
      else if (q.style === 'checkboxes') value = JSON.stringify(fields.getCheckboxGroup(q.id))
      else if (q.style === 'checkbox')
        value = String(
          q.required ? fields.getCheckboxGroup(q.id).includes('confirm') : fields.getCheckbox(q.id),
        )
      else value = fields.getTextInputValue(q.id)
      return [q.id, value]
    }),
  )
}
