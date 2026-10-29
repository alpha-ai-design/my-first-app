export default function ComingSoon({ title }: { title: string }) {
  return (
    <main className="mx-auto max-w-md px-4 pt-20 text-center">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mt-3 text-xl text-stone-500">Coming soon</p>
    </main>
  );
}
