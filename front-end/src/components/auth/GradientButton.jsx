export default function GradientButton({
  label,
  onClick,
  variant = "dark",
  disabled = false,
  type = "button",
}) {
  const base =
    "select-none uppercase rounded-[10px] px-[45px] py-[12px] text-[12px] font-bold tracking-[1px] transition active:scale-[0.98] inline-flex items-center justify-center";

  const dark =
    "text-white bg-gradient-to-r from-[#6441a5] via-[#2a0845] to-[#6441a5] hover:opacity-95";

  const light =
    "text-[#6441a5] bg-white/90 backdrop-blur-sm border border-white/60 shadow-[0_8px_24px_rgba(0,0,0,0.25)] hover:bg-white";

  const disabledCls = "opacity-60 cursor-not-allowed active:scale-100";

  return (
    <button
      type={type}
      className={[
        base,
        variant === "light" ? light : dark,
        disabled ? disabledCls : "cursor-pointer",
      ].join(" ")}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}
