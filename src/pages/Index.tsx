
import { useState } from "react";
import { Header } from "@/components/Header";
import { Navigation } from "@/components/Navigation";
import { ChatInterface } from "@/components/ChatInterface";
import { ImageGenerator } from "@/components/ImageGenerator";
import { VisionAnalyzer } from "@/components/VisionAnalyzer";
import { DocumentAnalyzer } from "@/components/DocumentAnalyzer";
import { StatusPanel } from "@/components/StatusPanel";
import { Reminders } from "@/components/Reminders/Reminders";
import { AIBuilder } from "@/components/AIBuilder/AIBuilder";

const Index = () => {
  const [activeTab, setActiveTab] = useState("chat");
  const [currentModel, setCurrentModel] = useState("gpt-4o");
  const [systemStatus, setSystemStatus] = useState("Online");

  const renderActiveComponent = () => {
    switch (activeTab) {
      case "chat":
        return <ChatInterface currentModel={currentModel} setCurrentModel={setCurrentModel} />;
      case "image":
        return <ImageGenerator />;
      case "vision":
        return <VisionAnalyzer />;
      case "documents":
        return <DocumentAnalyzer />;
      case "reminders":
        return <Reminders />;
      case "ai-builder":
        return <AIBuilder />;
      default:
        return <ChatInterface currentModel={currentModel} setCurrentModel={setCurrentModel} />;
    }
  };

  return (
    <div className="min-h-screen bg-deepseek-dark font-inter text-white">
      <div className="flex flex-col h-screen">
        <Header />
        
        <div className="flex flex-1 overflow-hidden">
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col">
            <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
            
            <main className="flex-1 p-6 overflow-auto">
              {renderActiveComponent()}
            </main>
          </div>
          
          {/* Status Panel Sidebar */}
          <StatusPanel 
            currentModel={currentModel} 
            systemStatus={systemStatus}
            setSystemStatus={setSystemStatus}
          />
        </div>
      </div>
    </div>
  );
};

export default Index;
