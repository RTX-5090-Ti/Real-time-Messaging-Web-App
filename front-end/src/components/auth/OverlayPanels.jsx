import GradientButton from "./GradientButton";

export default function OverlayPanels({
  rightPanelActive,
  onSignIn,
  onSignUp,
}) {
  return (
    <div
      className={[
        "absolute top-0 left-1/2 w-1/2 h-full overflow-hidden",
        "z-[50] transform-gpu [will-change:transform] pointer-events-auto",
        "transition-transform duration-700 ease-in-out",
        rightPanelActive ? "-translate-x-full" : "translate-x-0",
        "max-md:hidden",
      ].join(" ")}
    >
      <div
        className={[
          "relative h-full w-[200%] -left-full text-white",
          "bg-gradient-to-r from-[#6441a5] to-[#2a0845] bg-cover bg-no-repeat",
          "transform-gpu [will-change:transform] [backface-visibility:hidden] [transform:translateZ(0)]",
          "transition-transform duration-700 ease-in-out",
          rightPanelActive ? "translate-x-1/2" : "translate-x-0",
        ].join(" ")}
      >
        {/* Left panel */}
        <div className="absolute top-0 left-0 flex items-center justify-center w-1/2 h-full">
          {/* wrapper chịu transform */}
          <div
            className={[
              "w-full transition-transform duration-700 ease-in-out",
              rightPanelActive ? "translate-x-0" : "-translate-x-[20%]",
            ].join(" ")}
          >
            {/* content KHÔNG transform để chữ nét */}
            <div className="flex flex-col items-center justify-center px-10 subpixel-antialiased text-center">
              <h1 className="font-bold text-[32px] mb-2 drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                Welcome Back!
              </h1>
              <p className="text-[14px] font-thin tracking-[0.5px] leading-5 my-5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                Start from where you left
              </p>

              <GradientButton
                variant="light"
                label="Sign In"
                onClick={onSignIn}
              />
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="absolute top-0 right-0 flex items-center justify-center w-1/2 h-full">
          {/* wrapper chịu transform */}
          <div
            className={[
              "w-full transition-transform duration-700 ease-in-out",
              rightPanelActive ? "translate-x-[20%]" : "translate-x-0",
            ].join(" ")}
          >
            {/* content KHÔNG transform để chữ nét */}
            <div className="flex flex-col items-center justify-center px-10 subpixel-antialiased text-center">
              <h1 className="font-bold text-[32px] mb-2 drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                Hello, Buddy!
              </h1>
              <p className="text-[14px] font-thin tracking-[0.5px] leading-5 my-5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                Join Us on a new adventure
              </p>

              <GradientButton
                variant="light"
                label="Sign Up"
                onClick={onSignUp}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
