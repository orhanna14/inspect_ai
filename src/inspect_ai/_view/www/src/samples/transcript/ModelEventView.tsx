import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";
import "prismjs/components/prism-python";

import clsx from "clsx";
import { FC, Fragment, useMemo } from "react";
import { ApplicationIcons } from "../../appearance/icons";
import { MetaDataGrid } from "../../metadata/MetaDataGrid";
import {
  ModelCall,
  ModelEvent,
  Request,
  Response,
  Tools1,
} from "../../types/log";
import { ModelUsagePanel } from "../../usage/ModelUsagePanel";
import { ChatView } from "../chat/ChatView";
import { EventPanel } from "./event/EventPanel";
import { EventSection } from "./event/EventSection";

import { PulsingDots } from "../../components/PulsingDots";
import { usePrismHighlight } from "../../state/hooks";
import styles from "./ModelEventView.module.css";
import { EventTimingPanel } from "./event/EventTimingPanel";
import { formatTiming, formatTitle } from "./event/utils";

interface ModelEventViewProps {
  id: string;
  event: ModelEvent;
  className?: string | string[];
}

/**
 * Renders the StateEventView component.
 */
export const ModelEventView: FC<ModelEventViewProps> = ({
  id,
  event,
  className,
}) => {
  const totalUsage = event.output.usage?.total_tokens;
  const callTime = event.output.time;

  // Note: despite the type system saying otherwise, this has appeared empircally
  // to sometimes be undefined
  const outputMessages = event.output.choices?.map((choice) => {
    return choice.message;
  });

  const entries: Record<string, unknown> = { ...event.config };
  entries["tool_choice"] = event.tool_choice;
  delete entries["max_connections"];

  // For any user messages which immediately preceded this model call, including a
  // panel and display those user messages (exclude tool_call messages as they
  // are already shown in the tool call above)
  const userMessages = [];
  for (const msg of event.input.slice().reverse()) {
    if (msg.role === "user" && !msg.tool_call_id) {
      userMessages.push(msg);
    } else {
      break;
    }
  }

  return (
    <EventPanel
      id={id}
      className={className}
      title={formatTitle(`Model Call: ${event.model}`, totalUsage, callTime)}
      subTitle={formatTiming(event.timestamp, event.working_start)}
      icon={ApplicationIcons.model}
    >
      <div data-name="Summary" className={styles.container}>
        <ChatView
          id={`${id}-model-output`}
          messages={[...userMessages, ...(outputMessages || [])]}
          className={clsx(styles.output)}
          numbered={false}
          toolCallStyle="compact"
        />
        {event.pending ? (
          <div className={clsx(styles.progress)}>
            <PulsingDots subtle={false} size="medium" />
          </div>
        ) : undefined}
      </div>
      <div data-name="All" className={styles.container}>
        <div className={styles.all}>
          <EventSection title="Configuration" className={styles.tableSelection}>
            <MetaDataGrid entries={entries} plain={true} />
          </EventSection>

          <EventSection title="Usage" className={styles.tableSelection}>
            {event.output.usage !== null ? (
              <ModelUsagePanel usage={event.output.usage} />
            ) : undefined}
          </EventSection>

          <EventSection title="Timing" className={styles.tableSelection}>
            <EventTimingPanel
              timestamp={event.timestamp}
              completed={event.completed}
              working_start={event.working_start}
              working_time={event.working_time}
            />
          </EventSection>

          <EventSection
            title="Tools"
            className={clsx(styles.tableSelection, styles.tools)}
          >
            <ToolsConfig tools={event.tools} />
          </EventSection>
        </div>

        <EventSection title="Messages">
          <ChatView
            id={`${id}-model-input-full`}
            messages={[...event.input, ...(outputMessages || [])]}
          />
        </EventSection>
      </div>

      {event.call ? (
        <APIView
          data-name="API"
          call={event.call}
          className={styles.container}
        />
      ) : (
        ""
      )}
    </EventPanel>
  );
};

interface APIViewProps {
  call: ModelCall;
  className?: string | string[];
}

export const APIView: FC<APIViewProps> = ({ call, className }) => {
  if (!call) {
    return null;
  }

  return (
    <div className={clsx(className)}>
      <EventSection title="Request">
        <APICodeCell contents={call.request} />
      </EventSection>
      <EventSection title="Response">
        <APICodeCell contents={call.response} />
      </EventSection>
    </div>
  );
};

interface APICodeCellProps {
  id?: string;
  contents: Request | Response;
}

export const APICodeCell: FC<APICodeCellProps> = ({ id, contents }) => {
  const sourceCode = useMemo(() => {
    return JSON.stringify(contents, undefined, 2);
  }, [contents]);
  const prismParentRef = usePrismHighlight(sourceCode);

  if (!contents) {
    return null;
  }

  return (
    <div ref={prismParentRef} className={clsx("model-call")}>
      <pre className={clsx(styles.codePre)}>
        <code
          id={id}
          className={clsx("language-json", styles.code, "text-size-small")}
        >
          {sourceCode}
        </code>
      </pre>
    </div>
  );
};

interface ToolConfigProps {
  tools: Tools1;
}

const ToolsConfig: FC<ToolConfigProps> = ({ tools }) => {
  const toolEls = tools.map((tool, idx) => {
    return (
      <Fragment key={`${tool.name}-${idx}`}>
        <div className={clsx("text-style-label", "text-style-secondary")}>
          {tool.name}
        </div>
        <div>{tool.description}</div>
      </Fragment>
    );
  });

  return <div className={styles.toolConfig}>{toolEls}</div>;
};
