export function FormFieldError({ message }: { message?: string }) {
  if (!message?.trim()) return null;
  return <p className="mt-1.5 text-sm text-red-600">{message}</p>;
}

export function fieldErrorBorder(hasError: boolean, className: string) {
  return hasError ? `${className} border-red-500 focus:border-red-500 focus:ring-red-500/30` : className;
}
