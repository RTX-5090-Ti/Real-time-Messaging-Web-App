export default function SessionStatus({ error, onRetry }) {
  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-r from-[#b06ab3] to-[#4568dc]">
      <div className="p-6 text-center text-white rounded-xl bg-black/20" role={error ? "alert" : "status"}>
        <p>{error ? "Không thể tải dữ liệu. Kiểm tra kết nối và thử lại." : "Đang tải..."}</p>
        {error && <button className="mt-4 px-4 py-2 rounded bg-white text-indigo-700" onClick={onRetry}>Thử lại</button>}
      </div>
    </div>
  );
}
