
import { MessageSquare, Image, Eye, FileText, Bell, Hammer } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navigation = ({ activeTab, setActiveTab }: NavigationProps) => {
  const tabs = [
    { id: "chat", label: "AI Chat", icon: MessageSquare },
    { id: "image", label: "Image Gen", icon: Image },
    { id: "vision", label: "Vision", icon: Eye },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "reminders", label: "Reminders", icon: Bell },
    { id: "ai-builder", label: "AI Builder", icon: Hammer },
  ];

  return (
    <nav className="bg-deepseek-darker border-b border-deepseek-gray-700">
      <div className="flex px-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center space-x-2 px-6 py-4 text-sm font-medium transition-all duration-200 border-b-2 hover:text-deepseek-electric",
                activeTab === tab.id
                  ? "text-deepseek-electric border-deepseek-electric bg-deepseek-dark/50"
                  : "text-deepseek-gray-300 border-transparent hover:border-deepseek-gray-600"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
