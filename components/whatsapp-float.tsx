import { whatsappHref } from "@/lib/contact-links";

export function WhatsAppFloat() {
  return (
    <a
      href={whatsappHref}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with Firestone Country Smokehouse on WhatsApp"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)_+_16px)] right-[calc(env(safe-area-inset-right)_+_16px)] z-50 inline-flex h-14 w-14 items-center justify-center gap-3 rounded-full border border-[#76594C] bg-[linear-gradient(135deg,#5a382b_0%,#35241d_58%,#1d1916_100%)] p-0 text-sm font-extrabold text-[#EEEEEA] shadow-[0_12px_26px_rgba(27,24,22,0.3)] transition hover:-translate-y-0.5 hover:border-[#A66B55] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#A66B55] sm:bottom-[calc(env(safe-area-inset-bottom)_+_20px)] sm:right-[calc(env(safe-area-inset-right)_+_20px)] sm:h-auto sm:w-auto sm:py-1.5 sm:pl-1.5 sm:pr-4 sm:gap-2.5 lg:bottom-6 lg:right-6 lg:py-2 lg:pl-2 lg:pr-5 lg:gap-3"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full border-0 bg-transparent text-[#72D68A] shadow-none sm:h-10 sm:w-10 sm:border sm:border-[#5E493D] sm:bg-[#27201C] sm:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" aria-hidden="true">
        <svg viewBox="0 0 32 32" className="h-7 w-7 fill-current sm:h-6 sm:w-6" role="img">
          <path d="M16.02 3.2A12.65 12.65 0 0 0 5.18 22.36L3.5 28.5l6.3-1.65A12.65 12.65 0 1 0 16.02 3.2Zm0 22.93a10.25 10.25 0 0 1-5.23-1.43l-.38-.23-3.74.98 1-3.64-.25-.4a10.27 10.27 0 1 1 8.6 4.72Zm5.63-7.7c-.3-.15-1.77-.87-2.05-.97-.28-.1-.48-.15-.68.15-.2.3-.78.97-.95 1.17-.18.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.68-1.62-.93-2.22-.24-.58-.49-.5-.68-.51h-.58c-.2 0-.53.08-.8.38-.28.3-1.05 1.02-1.05 2.49s1.08 2.89 1.23 3.09c.15.2 2.12 3.24 5.13 4.54.72.31 1.28.5 1.72.64.72.23 1.37.2 1.89.12.58-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35Z" />
        </svg>
      </span>
      <span className="sr-only whitespace-nowrap sm:not-sr-only">Chat with us</span>
    </a>
  );
}
