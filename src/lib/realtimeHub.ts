import { supabase } from "./db";
import type { RealtimeChannel } from "@supabase/supabase-js";

type EventCallback = (payload: any) => void;

/**
 * Singleton Realtime Multiplexer for WebRajya POS.
 * Merges multiple component subscriptions (AdminDashboard, KitchenDashboard, LiveKotMonitor, VirtualPrinterCenter)
 * into a single unified WebSocket channel, preventing connection bloat and redundant heartbeat overhead.
 */
class RealtimeBroadcastHub {
  private channel: RealtimeChannel | null = null;
  private orderListeners: Set<EventCallback> = new Set();
  private kotListeners: Set<EventCallback> = new Set();
  private teardownTimeout: NodeJS.Timeout | null = null;
  private currentStatus: string = "CLOSED";

  public isHealthy(): boolean {
    return this.currentStatus === "SUBSCRIBED";
  }

  public getStatus(): string {
    return this.currentStatus;
  }

  private ensureConnected() {
    if (this.teardownTimeout) {
      clearTimeout(this.teardownTimeout);
      this.teardownTimeout = null;
    }

    if (this.channel) return;

    this.currentStatus = "CONNECTING";
    this.channel = supabase
      .channel("webrajya_pos_realtime_hub")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          this.orderListeners.forEach((listener) => {
            try {
              listener(payload);
            } catch (err) {
              console.warn("[RealtimeHub] Order listener error:", err);
            }
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kots" },
        (payload) => {
          this.kotListeners.forEach((listener) => {
            try {
              listener(payload);
            } catch (err) {
              console.warn("[RealtimeHub] KOT listener error:", err);
            }
          });
        }
      )
      .subscribe((status) => {
        this.currentStatus = status;
        if ((import.meta as any).env?.DEV) {
          console.log("[RealtimeHub] WebSocket hub status:", status);
        }
      });
  }

  private checkEmpty() {
    if (this.orderListeners.size === 0 && this.kotListeners.size === 0) {
      // Debounce teardown by 5 seconds to prevent thrashing during fast tab switching
      if (!this.teardownTimeout) {
        this.teardownTimeout = setTimeout(() => {
          if (this.orderListeners.size === 0 && this.kotListeners.size === 0 && this.channel) {
            supabase.removeChannel(this.channel);
            this.channel = null;
            this.currentStatus = "CLOSED";
          }
          this.teardownTimeout = null;
        }, 5000);
      }
    }
  }

  subscribeToOrders(callback: EventCallback): () => void {
    this.orderListeners.add(callback);
    this.ensureConnected();

    return () => {
      this.orderListeners.delete(callback);
      this.checkEmpty();
    };
  }

  subscribeToKOTs(callback: EventCallback): () => void {
    this.kotListeners.add(callback);
    this.ensureConnected();

    return () => {
      this.kotListeners.delete(callback);
      this.checkEmpty();
    };
  }
}

export const RealtimeHub = new RealtimeBroadcastHub();
