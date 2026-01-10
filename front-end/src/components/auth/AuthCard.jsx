import SignInForm from "./SignInForm";
import SignUpForm from "./SignUpForm";
import OverlayPanels from "./OverlayPanels";

export default function AuthCard({
  rightPanelActive,
  onSignIn,
  onSignUp,
  onSignInSuccess,
}) {
  const motionFix =
    "transform-gpu [will-change:transform] [backface-visibility:hidden]";

  return (
    <div
      className={[
        "relative isolate overflow-hidden bg-white rounded-[10px]",
        "w-full max-w-[768px] min-h-[480px]",
        "shadow-[0_5px_10px_rgba(0,0,0,0.25),_0_5px_5px_rgba(0,0,0,0.22)]",
      ].join(" ")}
    >
      {/* Sign In */}
      <div
        className={[
          "absolute top-0 left-0 h-full w-1/2 z-[10]",
          "transition-transform duration-700 ease-in-out",
          motionFix,
          rightPanelActive ? "translate-x-full" : "translate-x-0",

          // mobile: full width + slide
          "max-md:w-full",
          rightPanelActive
            ? "max-md:-translate-x-full"
            : "max-md:translate-x-0",
        ].join(" ")}
      >
        <SignInForm onSignUp={onSignUp} onSuccess={onSignInSuccess} />
      </div>

      {/* Sign Up */}
      <div
        className={[
          "absolute top-0 left-0 h-full w-1/2",
          "transition-transform duration-700 ease-in-out",
          motionFix,
          rightPanelActive ? "translate-x-full z-[20]" : "translate-x-0 z-[0]",
          // desktop: ẩn/hiện bằng pointer-events + opacity (nhẹ thôi)
          rightPanelActive
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none",
          "transition-opacity duration-500",

          // mobile: full width + slide
          "max-md:w-full max-md:opacity-100 max-md:pointer-events-auto",
          rightPanelActive ? "max-md:translate-x-0" : "max-md:translate-x-full",
        ].join(" ")}
      >
        <SignUpForm onSignIn={onSignIn} />
      </div>

      {/* Overlay (desktop only) */}
      <OverlayPanels
        rightPanelActive={rightPanelActive}
        onSignIn={onSignIn}
        onSignUp={onSignUp}
      />
    </div>
  );
}
