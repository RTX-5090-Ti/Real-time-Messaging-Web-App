export default function TextInput({
  type = "text",
  placeholder,
  value,
  onChange,
  name,
  autoComplete,
}) {
  return (
    <input
      type={type}
      name={name}
      placeholder={placeholder}
      autoComplete={autoComplete}
      value={value}
      onChange={onChange}
      className="w-full rounded-xl bg-zinc-100 px-4 py-3 my-2 text-[14px] outline-none
                 focus:ring-2 focus:ring-indigo-400"
    />
  );
}
