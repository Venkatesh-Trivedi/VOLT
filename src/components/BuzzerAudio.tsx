import { useEffect, useState } from "react";

export function BuzzerAudio({
  buzzing,
  onError,
}: {
  buzzing: boolean;
  onError: (message: string) => void;
}) {
  const [context, setContext] = useState<AudioContext | null>(null);

  useEffect(
    () => () => {
      if (context) void context.close().catch(() => {});
    },
    [context],
  );

  useEffect(() => {
    if (!context || !buzzing) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 650;
    gain.gain.value = 0.045;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    return () => {
      oscillator.stop();
      oscillator.disconnect();
      gain.disconnect();
    };
  }, [context, buzzing]);

  return (
    <button
      className="button quiet"
      aria-pressed={context !== null}
      onClick={() => {
        if (context) {
          setContext(null);
          return;
        }
        try {
          const audio = new AudioContext();
          setContext(audio);
          void audio.resume().catch(() => {
            setContext((current) => (current === audio ? null : current));
            onError("The browser could not enable buzzer sound.");
          });
        } catch {
          onError("Buzzer sound is unavailable in this browser.");
        }
      }}
    >
      {context ? "Mute buzzer" : "Enable buzzer sound"}
    </button>
  );
}
