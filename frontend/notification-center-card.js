class NotificationCenterCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._showMuted = false;
    this._showInactive = false;
    this._lastStateSignature = null;
  }

  setConfig(config) {
    if (!config) throw new Error("Notification Center requires a configuration.");
    this._config = config;
    this._lastStateSignature = this._notificationStateSignature(this._hass);
    this._render();
  }

  set hass(value) {
    const signature = this._notificationStateSignature(value);
    this._hass = value;
    if (signature === this._lastStateSignature) return;
    this._lastStateSignature = signature;
    this._render();
  }

  get hass() {
    return this._hass;
  }

  getCardSize() {
    return 2;
  }

  _notificationStateSignature(hass) {
    if (!hass) return "";
    const configured = this._config.notifications;
    const wanted = configured === "all" || !configured
      ? null
      : new Set(Array.isArray(configured) ? configured : [configured]);

    return JSON.stringify(
      Object.entries(hass.states)
        .filter(([, state]) => state.attributes?.notification_id)
        .filter(([, state]) => !wanted || wanted.has(state.attributes.notification_id))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([entityId, state]) => [entityId, state.state, state.attributes])
    );
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
    const titleIcon = String(this._config.title_icon || "").trim();
    const cardStyle = this._config.style?.card || "";
    const listStyle = this._config.style?.list || "";
    const customCss = this._config.custom_css || "";

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
        header, .notification-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        .title-icon {
          display: flex;
          align-items: center;
          flex: 0 0 auto;
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
        .row.warning, .row.severity-warning { --notification-color: var(--warning-color, #e0a000); }
        .row.error, .row.critical, .row.severity-error, .row.severity-critical { --notification-color: var(--error-color, #db4437); }
        .row.info, .row.severity-info { --notification-color: var(--info-color, #039be5); }
        .row.muted, .row.is-muted { opacity: .55; }
        .icon, .notification-icon { color: var(--notification-color); display: flex; }
        .copy { min-width: 0; }
        .name, .notification-name { font-weight: 700; }
        .message, .notification-message { margin-top: 3px; opacity: .82; white-space: pre-wrap; }
        .meta, .notification-meta { margin-top: 5px; font-size: .78rem; opacity: .62; }
        .empty { padding: 20px 8px; text-align: center; opacity: .65; }
        ha-icon { --mdc-icon-size: 24px; }
        ${customCss}
      </style>
      <ha-card>
        <header class="notification-header">
          ${titleIcon ? `<div class="title-icon"><ha-icon icon="${this._escape(titleIcon)}"></ha-icon></div>` : ""}
          <div class="title">${this._escape(title)}</div>
          <div class="count">${active} active${muted ? " · " + muted + " muted" : ""}</div>
          <div class="controls">
            <button class="toggle-muted" title="Show or hide muted notifications">
              <ha-icon icon="${showMuted ? "mdi:eye" : "mdi:eye-off"}"></ha-icon>
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
    const css = override.css || attrs.css || "";
    const name = override.name || attrs.notification_name || attrs.friendly_name;
    const message = override.message || attrs.message || "";
    const muted = attrs.muted;
    const active = attrs.active === true;
    const value = attrs.outcome ?? entity.state ?? "unknown";
    const rowClasses = [
      "row",
      this._cssToken(severity, "normal"),
      `severity-${this._cssToken(severity, "normal")}`,
      `notification-${this._cssToken(id)}`,
      `value-${this._cssToken(value)}`,
      active ? "is-active" : "is-inactive",
      muted ? "muted" : "unmuted",
      muted ? "is-muted" : "is-unmuted",
    ].join(" ");
    const stateText = attrs.outcome && attrs.outcome !== "1" ? "Outcome " + attrs.outcome : "";
    const activeUntil = attrs.expires_at
      ? "Active until " + new Date(attrs.expires_at).toLocaleString()
      : "";
    const meta = muted
      ? "Muted until " + (attrs.muted_until || "later")
      : [stateText, activeUntil].filter(Boolean).join(" · ");
    return `
      <article class="${this._escape(rowClasses)}"
        data-notification-id="${this._escape(id)}"
        data-value="${this._escape(value)}"
        data-active="${active}"
        data-muted="${muted}"
        data-severity="${this._escape(severity)}"
        style="${this._escape(css)}">
        <div class="icon notification-icon"><ha-icon icon="${this._escape(icon)}"></ha-icon></div>
        <div class="copy">
          <div class="name notification-name">${this._escape(name)}</div>
          <div class="message notification-message">${this._escape(message)}</div>
          <div class="meta notification-meta">${this._escape(meta)}</div>
        </div>
        <button class="mute-button" data-mute="${this._escape(id)}" title="${muted ? "Unmute notification" : "Mute notification"}">
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

  _cssToken(value, fallback = "unknown") {
    const token = String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return token || fallback;
  }
}

class NotificationCenterCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._availableSignature = "";
  }

  set hass(value) {
    this._hass = value;
    const signature = this._availableNotifications().map((item) => `${item.id}:${item.name}`).join("|");
    if (!this.shadowRoot.childElementCount || signature !== this._availableSignature) {
      this._availableSignature = signature;
      this._render();
    }
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  _availableNotifications() {
    if (!this._hass) return [];
    return Object.values(this._hass.states)
      .filter((state) => state.attributes?.notification_id)
      .map((state) => ({
        id: state.attributes.notification_id,
        name: state.attributes.notification_name || state.attributes.friendly_name || state.attributes.notification_id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  _render() {
    if (!this.shadowRoot) return;
    const available = this._availableNotifications();
    this._availableSignature = available.map((item) => `${item.id}:${item.name}`).join("|");
    const allSelected = this._config.notifications === "all" || !this._config.notifications;
    const selected = new Set(Array.isArray(this._config.notifications) ? this._config.notifications : []);

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; color: var(--primary-text-color); }
        .editor { display: grid; gap: 20px; padding: 8px 4px 20px; }
        section { display: grid; gap: 12px; }
        section + section { border-top: 1px solid var(--divider-color, rgba(127,127,127,.28)); padding-top: 18px; }
        h3 { margin: 0; font-size: 1rem; font-weight: 700; }
        .help { margin: -6px 0 0; color: var(--secondary-text-color); font-size: .88rem; line-height: 1.4; }
        label.field { display: grid; gap: 6px; font-size: .9rem; font-weight: 600; }
        input[type="text"], textarea, select {
          box-sizing: border-box;
          width: 100%;
          color: var(--primary-text-color);
          background: var(--input-fill-color, var(--card-background-color));
          border: 1px solid var(--input-idle-line-color, var(--divider-color));
          border-radius: 6px;
          padding: 10px 12px;
          font: inherit;
        }
        textarea { min-height: 76px; resize: vertical; line-height: 1.45; }
        textarea.code { min-height: 180px; font-family: var(--code-font-family, monospace); font-size: .86rem; tab-size: 2; }
        input[type="text"]:focus, textarea:focus, select:focus {
          outline: 2px solid var(--primary-color);
          outline-offset: 1px;
          background: var(--input-fill-color, var(--card-background-color));
        }
        .toggle, .choice {
          display: grid;
          grid-template-columns: 20px minmax(0, 1fr);
          gap: 10px;
          align-items: start;
          cursor: pointer;
        }
        .toggle input, .choice input { width: 18px; height: 18px; margin: 1px 0 0; accent-color: var(--primary-color); }
        .toggle strong, .choice strong { display: block; font-size: .92rem; }
        .toggle span, .choice span { display: block; margin-top: 2px; color: var(--secondary-text-color); font-size: .82rem; line-height: 1.35; }
        .choices { display: grid; gap: 8px; padding: 10px 12px; border: 1px solid var(--divider-color); border-radius: 6px; }
        .empty-options { color: var(--secondary-text-color); font-size: .88rem; }
        .hidden { display: none; }
      </style>
      <div class="editor">
        <section>
          <h3>Card content</h3>
          <p class="help">Choose the heading and the message shown when this card has nothing to display.</p>
          <label class="field">Card title
            <input id="title" type="text" value="${this._escape(this._config.title || "Notifications")}">
          </label>
          <ha-icon-picker id="title_icon" label="Header icon (optional)"></ha-icon-picker>
          <label class="field">Empty-list message
            <textarea id="empty_text" rows="2">${this._escape(this._config.empty_text || "No active notifications")}</textarea>
          </label>
        </section>

        <section>
          <h3>Notifications to include</h3>
          <p class="help">Show every configured notification, or select only the notifications intended for this dashboard card.</p>
          <label class="toggle">
            <input id="all_notifications" type="checkbox" ${allSelected ? "checked" : ""}>
            <span><strong>All configured notifications</strong><span>New notifications will be included automatically.</span></span>
          </label>
          <div id="notification_choices" class="choices ${allSelected ? "hidden" : ""}">
            ${available.length ? available.map((item) => `
              <label class="choice">
                <input type="checkbox" data-notification-id="${this._escape(item.id)}" ${selected.has(item.id) ? "checked" : ""}>
                <span><strong>${this._escape(item.name)}</strong><span>${this._escape(item.id)}</span></span>
              </label>
            `).join("") : `<div class="empty-options">No Notification Center definitions are available yet.</div>`}
          </div>
        </section>

        <section>
          <h3>Display behavior</h3>
          <p class="help">Inactive and muted notifications are hidden by default. These options change the card's initial view.</p>
          <label class="field">Sort notifications
            <select id="sort">
              <option value="severity" ${this._config.sort !== "name" ? "selected" : ""}>Severity, most important first</option>
              <option value="name" ${this._config.sort === "name" ? "selected" : ""}>Notification name</option>
            </select>
          </label>
          <label class="toggle">
            <input id="show_muted" type="checkbox" ${this._config.show_muted === true ? "checked" : ""}>
            <span><strong>Show muted notifications initially</strong><span>Users can still show or hide muted notifications from the card.</span></span>
          </label>
          <label class="toggle">
            <input id="show_inactive" type="checkbox" ${this._config.show_inactive === true ? "checked" : ""}>
            <span><strong>Show inactive notifications</strong><span>Useful for testing and status dashboards; normally leave this off.</span></span>
          </label>
        </section>

        <section>
          <h3>Custom CSS</h3>
          <p class="help">Optional CSS applied inside this card. Use the documented classes to style rows, values, icons, names, messages, and mute controls.</p>
          <label class="field">Card CSS
            <textarea id="custom_css" class="code" rows="9" spellcheck="false" placeholder=".row.is-active { ... }">${this._escape(this._config.custom_css || "")}</textarea>
          </label>
        </section>
      </div>
    `;

    const titleIconPicker = this.shadowRoot.querySelector("#title_icon");
    if (titleIconPicker) {
      titleIconPicker.hass = this._hass;
      titleIconPicker.value = this._config.title_icon || "";
      titleIconPicker.addEventListener("value-changed", () => this._commit());
    }
    this.shadowRoot.querySelector("#title")?.addEventListener("change", () => this._commit());
    this.shadowRoot.querySelector("#empty_text")?.addEventListener("change", () => this._commit());
    this.shadowRoot.querySelector("#custom_css")?.addEventListener("change", () => this._commit());
    this.shadowRoot.querySelector("#sort")?.addEventListener("change", () => this._commit());
    this.shadowRoot.querySelector("#show_muted")?.addEventListener("change", () => this._commit());
    this.shadowRoot.querySelector("#show_inactive")?.addEventListener("change", () => this._commit());
    this.shadowRoot.querySelector("#all_notifications")?.addEventListener("change", (event) => {
      const next = { ...this._config };
      next.notifications = event.target.checked ? "all" : available.map((item) => item.id);
      this._setConfig(next, true);
    });
    this.shadowRoot.querySelectorAll("[data-notification-id]").forEach((input) => {
      input.addEventListener("change", () => this._commit());
    });
  }

  _commit() {
    const selected = [...this.shadowRoot.querySelectorAll("[data-notification-id]:checked")]
      .map((input) => input.dataset.notificationId);
    const next = {
      ...this._config,
      title: this.shadowRoot.querySelector("#title")?.value || "Notifications",
      title_icon: this.shadowRoot.querySelector("#title_icon")?.value || "",
      empty_text: this.shadowRoot.querySelector("#empty_text")?.value || "No active notifications",
      notifications: this.shadowRoot.querySelector("#all_notifications")?.checked ? "all" : selected,
      sort: this.shadowRoot.querySelector("#sort")?.value || "severity",
      show_muted: this.shadowRoot.querySelector("#show_muted")?.checked === true,
      show_inactive: this.shadowRoot.querySelector("#show_inactive")?.checked === true,
      custom_css: this.shadowRoot.querySelector("#custom_css")?.value || "",
    };
    this._setConfig(next, false);
  }

  _setConfig(next, rerender) {
    this._config = next;
    this.dispatchEvent(new CustomEvent("config-changed", {
      bubbles: true,
      composed: true,
      detail: { config: next },
    }));
    if (rerender) this._render();
  }

  _escape(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[char]));
  }
}
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
