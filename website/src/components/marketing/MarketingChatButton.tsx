"use client";

import type { SVGProps } from "react";

const WHATSAPP_PHONE = "19735664336";
const WHATSAPP_MESSAGE = "Hi Tamam, I'd like to connect.";
const WHATSAPP_HREF = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

export default function MarketingChatButton() {
  return (
    <a
      href={WHATSAPP_HREF}
      className="mk-chat-button"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with Tamam on WhatsApp"
    >
      <WhatsAppIcon aria-hidden="true" />
      <span>Chat with us</span>
    </a>
  );
}

function WhatsAppIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" {...props}>
      <path
        d="M6.7 25.5l1.3-4.8a10.1 10.1 0 1 1 3.8 3.7l-5.1 1.1Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 10.8c-.3-.8-.6-.8-.9-.8h-.8c-.3 0-.8.1-1.2.6-.4.5-1.5 1.5-1.5 3.5 0 2.1 1.6 4.1 1.8 4.4.2.3 3.1 4.8 7.6 6.5 3.7 1.5 4.5 1.2 5.3 1.1.8-.1 2.7-1.1 3.1-2.2.4-1.1.4-2 .3-2.2-.1-.2-.4-.3-.8-.5l-2.9-1.4c-.4-.2-.7-.2-1 .2-.3.4-1.1 1.4-1.4 1.7-.2.3-.5.3-.9.1-.4-.2-1.8-.7-3.4-2.1-1.2-1.1-2.1-2.5-2.3-2.9-.2-.4 0-.6.2-.8.2-.2.4-.5.6-.7.2-.2.3-.4.5-.7.2-.3.1-.5 0-.8l-1.3-3Z"
        fill="currentColor"
      />
    </svg>
  );
}
