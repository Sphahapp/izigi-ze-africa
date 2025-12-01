import { useState } from "react";
import { Activity, Cpu, Zap, RefreshCw, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ApiKeyManager } from "./ApiKeyManager";

interface StatusPanelProps {
  currentModel: string;
  systemStatus: string;
  setSystemStatus: (status: string) => void;
}

export const StatusPanel = ({ currentModel, systemStatus, setSystemStatus }: StatusPanelProps) => {
  const [isUpgrading, setIsUpgrading] = useState(false);
  const version = "v1.2.1";

  const handleUpgradeCheck = async () => {
    setIsUpgrading(true);
    setSystemStatus("Checking for updates...");
    
    // Simulate upgrade check
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setSystemStatus("Connecting to DeepSeek servers...");
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setSystemStatus("System is up-to-date");
    setIsUpgrading(false);
    
    toast.success("System check complete - All systems optimal");
  };

  const getStatusColor = (status: string) => {
    if (status.includes("up-to-date") || status === "Online") return "text-green-400";
    if (status.includes("Checking") || status.includes("Connecting")) return "text-yellow-400";
    return "text-deepseek-gray-300";
  };

  const getStatusIcon = (status: string) => {
    if (status.includes("up-to-date") || status === "Online") return CheckCircle;
    if (status.includes("Checking") || status.includes("Connecting")) return RefreshCw;
    return Activity;
  };

  const StatusIcon = getStatusIcon(systemStatus);

  return (
    <div className="w-80 bg-deepseek-darker border-l border-deepseek-gray-700 p-6 space-y-6 overflow-auto">
      <div className="border-b border-deepseek-gray-700 pb-4">
        <h3 className="text-lg font-semibold text-white mb-2">System Status</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-deepseek-gray-300">Version:</span>
            <span className="text-sm font-mono text-deepseek-electric">{version}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-deepseek-gray-300">Active Model:</span>
            <span className="text-sm font-mono text-white">{currentModel}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-deepseek-gray-300">Status:</span>
            <div className="flex items-center space-x-1">
              <StatusIcon className={`h-4 w-4 ${getStatusColor(systemStatus)} ${systemStatus.includes("Checking") || systemStatus.includes("Connecting") ? "animate-spin" : ""}`} />
              <span className={`text-sm font-medium ${getStatusColor(systemStatus)}`}>
                {systemStatus}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <Button
          onClick={handleUpgradeCheck}
          disabled={isUpgrading}
          className="w-full bg-deepseek-gray-800 hover:bg-deepseek-gray-700 text-white border border-deepseek-gray-600"
        >
          {isUpgrading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Check for Updates
            </>
          )}
        </Button>
      </div>

      <ApiKeyManager />

      <div className="bg-deepseek-gray-800 rounded-lg p-4 border border-deepseek-gray-600">
        <h4 className="text-sm font-medium text-white mb-3 flex items-center">
          <Cpu className="h-4 w-4 mr-2 text-deepseek-electric" />
          System Resources
        </h4>
        <div className="space-y-3 text-xs">
          <div className="flex justify-between">
            <span className="text-deepseek-gray-300">AI Cores:</span>
            <span className="text-green-400">4/4 Active</span>
          </div>
          <div className="flex justify-between">
            <span className="text-deepseek-gray-300">Memory:</span>
            <span className="text-green-400">82% Available</span>
          </div>
          <div className="flex justify-between">
            <span className="text-deepseek-gray-300">Network:</span>
            <span className="text-green-400">Optimal</span>
          </div>
          <div className="flex justify-between">
            <span className="text-deepseek-gray-300">Queue:</span>
            <span className="text-green-400">0 pending</span>
          </div>
        </div>
      </div>

      <div className="bg-deepseek-gray-800 rounded-lg p-4 border border-deepseek-gray-600">
        <h4 className="text-sm font-medium text-white mb-3">Available Models</h4>
        <div className="space-y-2 text-xs">
          {[
            { name: "GPT-4o", status: "Online" },
            { name: "O3-Mini", status: "Online" },
            { name: "Claude Sonnet", status: "Online" },
            { name: "Gemini Pro", status: "Online" },
            { name: "Llama-4-Maverick-17B", status: "Online", specialty: "Vision & Docs" },
          ].map((model) => (
            <div key={model.name} className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-deepseek-gray-300">{model.name}</span>
                {model.specialty && (
                  <span className="text-deepseek-electric text-xs">{model.specialty}</span>
                )}
              </div>
              <div className="flex items-center space-x-1">
                <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-400">{model.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs text-deepseek-gray-500 text-center border-t border-deepseek-gray-700 pt-4">
        DeepSeek AI Console
        <br />
        Powered by Puter.js
      </div>
    </div>
  );
};
