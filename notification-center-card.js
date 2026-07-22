class NotificationCenterCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._showMuted = false;
    this._showInactive = false;
  }

  setConfig(config) {
    if (!config) throw new Error("Notification Center requires a configuration.");
    this._config = config;
    this._render();
  }

  set hass(value) {
    this._hass = value;
    this._render();
  }

  get hass() {
    return this._hass;
  }

  getCardSize() {
    return 2;
  }

  _notificationEntities() {
    if (!this._hass) return [];
    const configured = this._config.notifications;
    const wanted = configured === "all" || !configured
      ? null
      : new Set(Array.isArray(configured) ? configured : [configured]);

    return Object.values(this._hass.states)
      .filter((state) => state.attributes && state.attributes.notification_id)
      .filter((state) => !wanted || wanted.has(state.attributes.notification_id))
      .sort((a, b) => {
        const order = { critical: 0, error: 1, warning: 2, normal: 3, info: 4 };
        if (this._config.sort === "name") {
          return (a.attributes.notification_name || a.attributes.friendly_name).localeCompare(
            b.attributes.notification_name || b.attributes.friendly_name
          );
        }
        return (order[a.attributes.severity] ?? 3) - (order[b.attributes.severity] ?? 3);
      });
  }

  _visible(entity) {
    const attrs = entity.attributes;
    if (attrs.global_muted) return false;
    if (!attrs.active && !this._showInactive && !this._config.show_inactive) return false;
    if (attrs.muted && !this._showMuted && !this._config.show_muted) return false;
    return true;
  }

  _service(service, data) {
    if (this._hass) this._hass.callService("notification_center", service, data);
  }

  _render() {
    if (!this.shadowRoot) return;
    const entities = this._notificationEntities();
    const visible = entities.filter((entity) => this._visible(entity));
    const active = entities.filter((entity) => entity.attributes.active && !entity.attributes.muted).length;
    const muted = entities.filter((entity) => entity.attributes.active && entity.attributes.muted).length;
    const showMuted = this._showMuted || this._config.show_muted === true;
    const showInactive = this._showInactive || this._config.show_inactive === true;
    const title = this._config.title || "Notifications";
    const cardStyle = this._config.style?.card || "";
    const listStyle = this._config.style?.list || "";

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card {
          padding: 16px;
          color: var(--primary-text-color);
          background: var(--ha-card-background, var(--card-background-color, white));
          border-radius: var(--ha-card-border-radius, 12px);
          box-shadow: var(--ha-card-box-shadow, none);
          ${cardStyle}
        }
        header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        .title { flex: 1; font-size: 1.25rem; font-weight: 700; }
        .count { opacity: .7; font-size: .9rem; }
        button {
          color: inherit;
          background: transparent;
          border: 0;
          cursor: pointer;
          min-height: 36px;
          padding: 6px 8px;
          border-radius: 8px;
        }
        button:hover { background: rgba(127,127,127,.14); }
        .controls { display: flex; gap: 4px; }
        .list { display: grid; gap: 8px; ${listStyle} }
        .row {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 12px;
          border: 1px solid rgba(127,127,127,.28);
          border-left: 4px solid var(--notification-color, rgba(127,127,127,.5));
          border-radius: 8px;
          background: rgba(127,127,127,.08);
        }
        .row.warning { --notification-color: var(--warning-color, #e0a000); }
        .row.error, .row.critical { --notification-color: var(--error-color, #db4437); }
        .row.info { --notification-color: var(--info-color, #039be5); }
        .row.muted { opacity: .55; }
        .icon { color: var(--notification-color); display: flex; }
        .copy { min-width: 0; }
        .name { font-weight: 700; }
        .message { margin-top: 3px; opacity: .82; white-space: pre-wrap; }
        .meta { margin-top: 5px; font-size: .78rem; opacity: .62; }
        .empty { padding: 20px 8px; text-align: center; opacity: .65; }
        ha-icon { --mdc-icon-size: 24px; }
      </style>
      <ha-card>
        <header>
          <div class="title">${this._escape(title)}</div>
          <div class="count">${active} active${muted ? " · " + muted + " muted" : ""}</div>
          <div class="controls">
            <button class="toggle-muted" title="Show or hide muted notifications">
              <ha-icon icon="${showMuted ? "mdi:bell-off" : "mdi:bell"}"></ha-icon>
            </button>
          </div>
        </header>
        <section class="list">
          ${visible.length ? visible.map((entity) => this._row(entity)).join("") : `<div class="empty">${this._escape(this._config.empty_text || "No active notifications")}</div>`}
        </section>
      </ha-card>
    `;

    this.shadowRoot.querySelector(".toggle-muted")?.addEventListener("click", () => {
      this._showMuted = !this._showMuted;
      this._render();
    });
    this.shadowRoot.querySelectorAll("[data-mute]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.mute;
        const entity = entities.find((item) => item.attributes.notification_id === id);
        if (entity?.attributes.muted) this._service("unmute", { notification_id: id });
        else this._service("mute", { notification_id: id });
      });
    });
  }

  _row(entity) {
    const attrs = entity.attributes;
    const id = attrs.notification_id;
    const override = this._config.overrides?.[id] || {};
    const severity = override.severity || attrs.severity || "normal";
    const icon = override.icon || attrs.icon || "mdi:bell-outline";
    const css = override.css || "";
    const name = override.name || attrs.notification_name || attrs.friendly_name;
    const message = override.message || attrs.message || "";
    const muted = attrs.muted;
    const stateText = attrs.outcome && attrs.outcome !== "1" ? "Outcome " + attrs.outcome : "";
    return `
      <article class="row ${this._escape(severity)} ${muted ? "muted" : ""}" style="${this._escape(css)}">
        <div class="icon"><ha-icon icon="${this._escape(icon)}"></ha-icon></div>
        <div class="copy">
          <div class="name">${this._escape(name)}</div>
          <div class="message">${this._escape(message)}</div>
          <div class="meta">${muted ? "Muted until " + this._escape(attrs.muted_until || "later") : stateText}</div>
        </div>
        <button data-mute="${this._escape(id)}" title="${muted ? "Unmute notification" : "Mute notification"}">
          <ha-icon icon="${muted ? "mdi:bell" : "mdi:bell-off"}"></ha-icon>
        </button>
      </article>
    `;
  }

  _escape(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[char]));
  }
}

NotificationCenterCard.getConfigElement = () => document.createElement("notification-center-card-editor");

class NotificationCenterCardEditor extends HTMLElement { constructor() { super(); this.attachShadow({mode: "open"}); this._config = {}; } setConfig(config) { this._config = {...config}; this._render(); } _render() { this.shadowRoot.innerHTML = "<label>Title <input id='title'></label><label>Notification IDs <input id='notifications'></label>"; this.shadowRoot.querySelector('#title').value = this._config.title || 'Notifications'; this.shadowRoot.querySelector('#notifications').value = Array.isArray(this._config.notifications) ? this._config.notifications.join(', ') : (this._config.notifications || 'all'); this.shadowRoot.querySelectorAll('input').forEach((input) => input.addEventListener('change', () => { const next = {...this._config, title: this.shadowRoot.querySelector('#title').value}; const ids = this.shadowRoot.querySelector('#notifications').value.trim(); next.notifications = ids === 'all' ? 'all' : ids.split(',').map((item) => item.trim()).filter(Boolean); this._config = next; this.dispatchEvent(new CustomEvent('config-changed', {bubbles: true, composed: true, detail: {config: next}})); })); } }
customElements.define("notification-center-card-editor", NotificationCenterCardEditor);
NotificationCenterCard.getConfigElement = () => document.createElement("notification-center-card-editor");
customElements.define("notification-center-card", NotificationCenterCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "notification-center-card",
  name: "Notification Center",
  description: "Active Home Assistant notifications with outcome-aware Jinja evaluation and device delivery.",
  preview: true
});
