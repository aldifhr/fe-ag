import Spinner from "@/components/Spinner";

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Spinner size={24} />
    </div>
  );
}
