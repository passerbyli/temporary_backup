export default {
  created() {
    const i18n = this.$i18n;
    if (!i18n || typeof i18n.mergeLocaleMessage !== "function") return;

    const messages = this.$options?.i18n?.messages;
    if (!messages) return;

    if (this.__i18nMerged) return;
    this.__i18nMerged = true;

    Object.keys(messages).forEach((locale) => {
      i18n.mergeLocaleMessage(locale, messages[locale]);
    });
  },
};
