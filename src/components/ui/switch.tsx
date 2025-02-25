import * as React from "react";
import { cn } from "../../lib/utils";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function Switch({ 
  checked, 
  onCheckedChange, 
  disabled = false, 
  className = '' 
}: SwitchProps) {
  // Track internal state to make the component respond immediately
  const [isChecked, setIsChecked] = React.useState(checked);
  
  // Sync with parent state when it changes
  React.useEffect(() => {
    setIsChecked(checked);
  }, [checked]);
  
  const handleClick = () => {
    if (disabled) return;
    
    const newValue = !isChecked;
    setIsChecked(newValue);
    onCheckedChange(newValue);
  };
  
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isChecked}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        isChecked ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        className
      )}
      onClick={handleClick}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
          isChecked ? "translate-x-5" : "translate-x-1"
        )}
      />
    </button>
  );
} 