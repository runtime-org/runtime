import { HiTrash } from "react-icons/hi2";

export default function ConfirmModal({ message, onConfirm, onCancel }) {
    return (
        <div className="absolute inset-0 flex items-center justify-center z-50">
            <div className="bg-[#242424] rounded-xl mt-2 p-6 w-[90%] max-w-sm shadow-xl border border-[#484848]/50 relative">
                <div className="flex flex-col items-center gap-4">
                    <div className="p-3 rounded-full bg-red-500/10">
                        <HiTrash className="w-6 h-6 text-red-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Clear All Sessions</h3>
                    <p className="text-[#9E9E9E] text-center">{message}</p>
                    <div className="flex gap-3 w-full mt-2">
                        <div
                            onClick={onCancel}
                            className="flex-1 px-4 py-2 rounded-lg bg-[#323232] text-[#9E9E9E] hover:bg-[#3B3B3E] transition-colors"
                        >
                            Cancel
                        </div>
                        <div
                            onClick={onConfirm}
                            className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                        >
                            Clear All
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}